/**
 * Image processing pipeline for receipt uploads.
 * Handles HEIC→JPEG conversion, EXIF auto-rotation, and compression.
 */
import heic2any from 'heic2any';
import imageCompression from 'browser-image-compression';

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const HEIC_TYPES = ['image/heic', 'image/heif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB input limit
const COMPRESSION_THRESHOLD = 5 * 1024 * 1024; // 5 MB

const COMPRESSION_OPTIONS = {
  maxSizeMB: 5,
  maxWidthOrHeight: 2500,
  initialQuality: 0.9,
  useWebWorker: true,
  fileType: 'image/jpeg',
};

/**
 * Validate file type and size before processing.
 * @param {File} file
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateImageFile(file) {
  if (!file) return { valid: false, error: 'No file provided' };
  const type = file.type.toLowerCase();
  const name = (file.name || '').toLowerCase();
  const isHeic = HEIC_TYPES.includes(type) || name.endsWith('.heic') || name.endsWith('.heif');
  if (!ACCEPTED_TYPES.includes(type) && !isHeic) {
    return { valid: false, error: 'Only JPG, JPEG, and PNG images are accepted' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File must be under 10 MB' };
  }
  return { valid: true };
}

/**
 * Process a raw File/Blob into an upload-ready JPEG Blob.
 * Steps: HEIC conversion → EXIF auto-rotation → compression if >5MB.
 * @param {File} file - User-selected image file
 * @returns {Promise<{blob: Blob, previewUrl: string}>}
 * @throws {Error} If file type is unsupported or processing fails
 */
export async function processImage(file) {
  let blob = file;

  // Step 1: HEIC → JPEG conversion
  const type = file.type.toLowerCase();
  const name = (file.name || '').toLowerCase();
  const isHeic = HEIC_TYPES.includes(type) || name.endsWith('.heic') || name.endsWith('.heif');

  if (isHeic) {
    blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
    // heic2any may return an array for multi-frame HEIF; take the first frame
    if (Array.isArray(blob)) blob = blob[0];
  }

  // Step 2: EXIF auto-rotation + compression
  // browser-image-compression always corrects EXIF orientation
  if (blob.size > COMPRESSION_THRESHOLD) {
    blob = await imageCompression(blob, COMPRESSION_OPTIONS);
  } else {
    // Even for small files, run through imageCompression for EXIF rotation
    blob = await imageCompression(blob, {
      maxSizeMB: Infinity,
      maxWidthOrHeight: Infinity,
      useWebWorker: true,
      fileType: 'image/jpeg',
    });
  }

  const previewUrl = URL.createObjectURL(blob);
  return { blob, previewUrl };
}

/**
 * Convert a Blob to a base64 data string (without the data:...;base64, prefix).
 * Used for Document AI rawDocument.content.
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
