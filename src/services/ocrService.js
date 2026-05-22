/**
 * Tesseract.js OCR extraction service.
 * Runs OCR entirely in the browser using a Web Worker — no cloud API needed.
 * Replaces the former Document AI service with a free, offline-capable alternative.
 */
import { createWorker } from 'tesseract.js';
import { parseBillText, parsePaymentText } from '../utils/parseOcrText';

// ── Singleton worker ────────────────────────────────────────────────

let workerInstance = null;

/**
 * Lazy-initialize a Tesseract.js worker for English text recognition.
 * The worker is created once and reused for all subsequent OCR calls.
 * @returns {Promise<import('tesseract.js').Worker>}
 */
async function getWorker() {
  if (!workerInstance) {
    workerInstance = await createWorker('eng');
    await workerInstance.setParameters({
      tessedit_pageseg_mode: '6',       // Single uniform block of text
      preserve_interword_spaces: '1',   // Maintain word spacing (important for tables)
    });
  }
  return workerInstance;
}

/**
 * Terminate the OCR worker to free memory.
 * Call this when the user navigates away from the upload flow.
 */
export async function terminateOcrWorker() {
  if (workerInstance) {
    await workerInstance.terminate();
    workerInstance = null;
  }
}

// ── Image preprocessing for OCR ─────────────────────────────────────

/**
 * Preprocess an image blob for better OCR results.
 * Multi-step pipeline: dark inversion → grayscale → contrast stretch →
 * adaptive threshold → upscale. All done via Canvas 2D API.
 * @param {Blob} imageBlob - Input image blob
 * @returns {Promise<Blob>} Processed blob optimized for Tesseract
 */
async function preprocessForOcr(imageBlob) {
  const imageBitmap = await createImageBitmap(imageBlob);
  let canvas = document.createElement('canvas');
  canvas.width = imageBitmap.width;
  canvas.height = imageBitmap.height;
  let ctx = canvas.getContext('2d');
  ctx.drawImage(imageBitmap, 0, 0);
  imageBitmap.close();

  const w = canvas.width;
  const h = canvas.height;

  // ── Step 1: Dark-mode inversion (for GPay/PhonePe dark screenshots) ──
  let imageData = ctx.getImageData(0, 0, w, h);
  let pixels = imageData.data;

  let totalBrightness = 0;
  let sampleCount = 0;
  const step = 40 * 4;
  for (let i = 0; i < pixels.length; i += step) {
    totalBrightness += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
    sampleCount++;
  }
  if (totalBrightness / sampleCount < 128) {
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 255 - pixels[i];
      pixels[i + 1] = 255 - pixels[i + 1];
      pixels[i + 2] = 255 - pixels[i + 2];
    }
    ctx.putImageData(imageData, 0, 0);
  }

  // ── Step 2: Grayscale conversion (luminosity method) ──
  imageData = ctx.getImageData(0, 0, w, h);
  pixels = imageData.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const gray = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
    pixels[i] = gray;
    pixels[i + 1] = gray;
    pixels[i + 2] = gray;
  }
  ctx.putImageData(imageData, 0, 0);

  // ── Detect if image is a clean digital screenshot vs a phone photo ──
  // Clean screenshots (KBL NEFT, GPay, PhonePe) already have high contrast.
  // Aggressive preprocessing (contrast stretch + binarization) destroys their
  // label text and thin characters. Only apply Steps 3-4 to phone photos.
  imageData = ctx.getImageData(0, 0, w, h);
  pixels = imageData.data;
  let darkCount = 0;
  let brightCount = 0;
  const totalPixels = w * h;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] < 50) darkCount++;
    if (pixels[i] > 200) brightCount++;
  }
  const isCleanScreenshot = (darkCount + brightCount) / totalPixels > 0.60;

  if (!isCleanScreenshot) {
    // ── Step 3: Contrast stretching (phone photos only) ──
    let minVal = 255;
    let maxVal = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const v = pixels[i];
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }
    const range = maxVal - minVal;
    if (range > 0 && range < 230) {
      for (let i = 0; i < pixels.length; i += 4) {
        const stretched = Math.round(((pixels[i] - minVal) / range) * 255);
        pixels[i] = stretched;
        pixels[i + 1] = stretched;
        pixels[i + 2] = stretched;
      }
      ctx.putImageData(imageData, 0, 0);
    }

    // ── Step 4: Adaptive thresholding (phone photos only) ──
    // Uses integral image for O(1) per-pixel mean calculation
    imageData = ctx.getImageData(0, 0, w, h);
    pixels = imageData.data;

    const integral = new Float64Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) {
      let rowSum = 0;
      for (let x = 0; x < w; x++) {
        rowSum += pixels[(y * w + x) * 4];
        integral[(y + 1) * (w + 1) + (x + 1)] =
          rowSum + integral[y * (w + 1) + (x + 1)];
      }
    }

    const halfWin = 15;
    const C = 12;
    const output = new Uint8ClampedArray(pixels.length);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const x1 = Math.max(0, x - halfWin);
        const y1 = Math.max(0, y - halfWin);
        const x2 = Math.min(w - 1, x + halfWin);
        const y2 = Math.min(h - 1, y + halfWin);

        const area = (x2 - x1 + 1) * (y2 - y1 + 1);
        const sum =
          integral[(y2 + 1) * (w + 1) + (x2 + 1)] -
          integral[y1 * (w + 1) + (x2 + 1)] -
          integral[(y2 + 1) * (w + 1) + x1] +
          integral[y1 * (w + 1) + x1];

        const mean = sum / area;
        const idx = (y * w + x) * 4;
        const val = pixels[idx] < (mean - C) ? 0 : 255;
        output[idx] = val;
        output[idx + 1] = val;
        output[idx + 2] = val;
        output[idx + 3] = 255;
      }
    }

    const binarized = new ImageData(output, w, h);
    ctx.putImageData(binarized, 0, 0);
  }

  // ── Step 5: Upscale small images (Tesseract needs ~300 DPI equivalent) ──
  if (w < 1500) {
    const scale = 2;
    const upCanvas = document.createElement('canvas');
    upCanvas.width = w * scale;
    upCanvas.height = h * scale;
    const upCtx = upCanvas.getContext('2d');
    upCtx.imageSmoothingEnabled = true;
    upCtx.imageSmoothingQuality = 'high';
    upCtx.drawImage(canvas, 0, 0, w, h, 0, 0, upCanvas.width, upCanvas.height);
    canvas = upCanvas;
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.95);
  });
}

// ── Core OCR ────────────────────────────────────────────────────────

/**
 * Run Tesseract OCR on an image blob and return the raw text + confidence.
 * Preprocesses dark images (inverts colors) before running OCR.
 * @param {Blob} imageBlob - Processed JPEG image blob
 * @returns {Promise<{ text: string, confidence: number }>}
 *   confidence is 0-1 (Tesseract returns 0-100, we normalize)
 */
async function runOcr(imageBlob) {
  const processedBlob = await preprocessForOcr(imageBlob);
  const worker = await getWorker();
  const { data } = await worker.recognize(processedBlob);
  return {
    text: data.text || '',
    confidence: (data.confidence || 0) / 100, // normalize 0-100 → 0-1
  };
}

// ── Public API (same interface as former documentAiService) ─────────

/**
 * Extract structured fields from a bill image via Tesseract OCR + regex parsing.
 * @param {Blob} imageBlob - Processed JPEG image blob
 * @returns {Promise<Object>} Bill extraction with field_confidences
 */
export async function extractBillFields(imageBlob) {
  const { text, confidence } = await runOcr(imageBlob);
  return parseBillText(text, confidence);
}

/**
 * Extract structured fields from a payment screenshot via Tesseract OCR + regex parsing.
 * @param {Blob} imageBlob - Processed JPEG image blob
 * @returns {Promise<Object>} Payment extraction with field_confidences
 */
export async function extractPaymentFields(imageBlob) {
  const { text, confidence } = await runOcr(imageBlob);
  return parsePaymentText(text, confidence);
}
