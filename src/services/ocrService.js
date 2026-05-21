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

// ── Core OCR ────────────────────────────────────────────────────────

/**
 * Run Tesseract OCR on an image blob and return the raw text + confidence.
 * @param {Blob} imageBlob - Processed JPEG image blob
 * @returns {Promise<{ text: string, confidence: number }>}
 *   confidence is 0-1 (Tesseract returns 0-100, we normalize)
 */
async function runOcr(imageBlob) {
  const worker = await getWorker();
  const { data } = await worker.recognize(imageBlob);
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
