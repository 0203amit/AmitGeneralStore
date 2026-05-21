/**
 * Parse plain-text OCR output (from Tesseract.js) into app field shapes.
 * Uses regex patterns to extract structured fields from raw text,
 * with confidence scoring and value normalization.
 */

import { detectPaymentMode } from './paymentModeDetector';

// ── Bill extraction patterns ────────────────────────────────────────

/** Invoice number patterns: INV-XXX, BL-XXX, BILL-XXX, or near common labels */
const INVOICE_LABEL_RE =
  /(?:inv(?:oice)?\s*(?:no|number|#)|bill\s*(?:no|number|#)|receipt\s*(?:no|number|#))[.:;\s]*([A-Za-z0-9\-/]+)/i;
const INVOICE_STANDALONE_RE = /\b(INV|BL|BILL)[\s-]*(\d{1,6})\b/i;

/** Date patterns: DD/MM/YY, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY */
const DATE_RE = /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/;

/** Amount patterns: after ₹ symbol, or near "Total", "Net Bill", "Amount", "Grand Total" */
const AMOUNT_RUPEE_RE = /₹\s*([\d,]+\.?\d*)/;
const AMOUNT_LABEL_RE =
  /(?:total|net\s*bill|grand\s*total|net\s*amount|amount)[.:;\s]*(?:₹|Rs\.?|INR)?\s*([\d,]+\.?\d*)/i;

// ── Payment extraction patterns ─────────────────────────────────────

/** UTR number: 12-digit number near "UTR" label, or standalone 12-22 digit number */
const UTR_LABEL_RE = /(?:utr|ref(?:erence)?(?:\s*(?:no|number|id|#))?)[.:;\s]*(\d{12,22})/i;
const UTR_STANDALONE_RE = /\b(\d{12,22})\b/;

// ── Shared helpers ──────────────────────────────────────────────────

/**
 * Normalize a date string from OCR to YYYY-MM-DD format.
 * Handles DD/MM/YYYY, DD-MM-YYYY, DD MMM YYYY, YYYY-MM-DD, and DD/MM/YY.
 * @param {string} dateStr
 * @returns {string} YYYY-MM-DD or original string if unparseable
 */
export function normalizeDate(dateStr) {
  if (!dateStr) return '';

  // Already correct: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  // DD/MM/YY or DD/MM/YYYY (or with - or . separators)
  const slashMatch = dateStr.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (slashMatch) {
    const [, day, month, yearRaw] = slashMatch;
    let year = yearRaw;
    // Handle 2-digit year
    if (year.length === 2) {
      const num = parseInt(year, 10);
      year = num > 50 ? `19${year}` : `20${year}`;
    }
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // DD MMM YYYY (e.g., "15 May 2026")
  const monthNames = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const textMatch = dateStr.match(/(\d{1,2})\s+(\w{3,})\s+(\d{4})/);
  if (textMatch) {
    const [, day, monthText, year] = textMatch;
    const monthNum = monthNames[monthText.toLowerCase().substring(0, 3)];
    if (monthNum) {
      return `${year}-${monthNum}-${day.padStart(2, '0')}`;
    }
  }

  return dateStr;
}

/**
 * Clean and normalize an amount string from OCR.
 * Strips currency symbols, commas, and whitespace.
 * @param {string} amountStr
 * @returns {string} Cleaned numeric string (e.g., "4250.00")
 */
export function normalizeAmount(amountStr) {
  if (!amountStr) return '';
  const cleaned = amountStr
    .replace(/₹/g, '')
    .replace(/Rs\.?/gi, '')
    .replace(/INR/gi, '')
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .trim();
  return cleaned || amountStr;
}

// ── Bill text parser ────────────────────────────────────────────────

/**
 * Extract bill fields from plain OCR text using regex patterns.
 * @param {string} text - Raw OCR text from Tesseract.js
 * @param {number} ocrConfidence - Overall Tesseract confidence (0-1)
 * @returns {{
 *   trader_name: string, trader_address: string, invoice_number: string,
 *   bill_date: string, bill_amount: string, currency: string,
 *   confidence: number, raw_text: string,
 *   field_confidences: Record<string, number>
 * }}
 */
export function parseBillText(text, ocrConfidence) {
  const raw_text = text || '';
  const result = {
    trader_name: '',
    trader_address: '',
    invoice_number: '',
    bill_date: '',
    bill_amount: '',
    currency: 'INR',
    confidence: 0,
    raw_text,
    field_confidences: {},
  };

  const lines = raw_text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Trader name: first non-empty line (heuristic — Indian bills typically have shop name at top)
  if (lines.length > 0) {
    result.trader_name = lines[0];
    result.field_confidences.trader_name = 0.6;
  }

  // Invoice number: labeled or standalone pattern
  const invLabelMatch = raw_text.match(INVOICE_LABEL_RE);
  if (invLabelMatch) {
    result.invoice_number = invLabelMatch[1].trim();
    result.field_confidences.invoice_number = 0.75;
  } else {
    const invStandaloneMatch = raw_text.match(INVOICE_STANDALONE_RE);
    if (invStandaloneMatch) {
      result.invoice_number = `${invStandaloneMatch[1]}-${invStandaloneMatch[2]}`;
      result.field_confidences.invoice_number = 0.65;
    }
  }

  // Bill date: DD/MM/YY or DD/MM/YYYY
  const dateMatch = raw_text.match(DATE_RE);
  if (dateMatch) {
    result.bill_date = normalizeDate(dateMatch[0]);
    result.field_confidences.bill_date = 0.7;
  }

  // Bill amount: ₹ symbol first, then label-based fallback
  const rupeeMatch = raw_text.match(AMOUNT_RUPEE_RE);
  if (rupeeMatch) {
    result.bill_amount = normalizeAmount(rupeeMatch[1]);
    result.field_confidences.bill_amount = 0.75;
  } else {
    const labelMatch = raw_text.match(AMOUNT_LABEL_RE);
    if (labelMatch) {
      result.bill_amount = normalizeAmount(labelMatch[1]);
      result.field_confidences.bill_amount = 0.7;
    }
  }

  // Currency: always INR for this app
  result.field_confidences.currency = 1.0;

  // Overall confidence: average of field confidences, weighted by OCR confidence
  const confValues = Object.values(result.field_confidences);
  const avgFieldConf = confValues.length > 0
    ? confValues.reduce((a, b) => a + b, 0) / confValues.length
    : 0;
  result.confidence = avgFieldConf * ocrConfidence;

  return result;
}

// ── Payment text parser ─────────────────────────────────────────────

/**
 * Extract payment fields from plain OCR text using regex patterns.
 * @param {string} text - Raw OCR text from Tesseract.js
 * @param {number} ocrConfidence - Overall Tesseract confidence (0-1)
 * @returns {{
 *   utr_number: string, payment_date: string, payment_mode: string,
 *   paid_amount: string, payer_name: string, payee_name: string,
 *   confidence: number, raw_text: string,
 *   field_confidences: Record<string, number>
 * }}
 */
export function parsePaymentText(text, ocrConfidence) {
  const raw_text = text || '';
  const result = {
    utr_number: '',
    payment_date: '',
    payment_mode: 'other',
    paid_amount: '',
    payer_name: '',
    payee_name: '',
    confidence: 0,
    raw_text,
    field_confidences: {},
  };

  // UTR number: labeled first, then standalone 12-22 digit fallback
  const utrLabelMatch = raw_text.match(UTR_LABEL_RE);
  if (utrLabelMatch) {
    result.utr_number = utrLabelMatch[1];
    result.field_confidences.utr_number = 0.8;
  } else {
    const utrStandaloneMatch = raw_text.match(UTR_STANDALONE_RE);
    if (utrStandaloneMatch) {
      result.utr_number = utrStandaloneMatch[1];
      result.field_confidences.utr_number = 0.65;
    }
  }

  // Payment date: DD/MM/YY or DD/MM/YYYY
  const dateMatch = raw_text.match(DATE_RE);
  if (dateMatch) {
    result.payment_date = normalizeDate(dateMatch[0]);
    result.field_confidences.payment_date = 0.7;
  }

  // Paid amount: ₹ symbol first, then label-based fallback
  const rupeeMatch = raw_text.match(AMOUNT_RUPEE_RE);
  if (rupeeMatch) {
    result.paid_amount = normalizeAmount(rupeeMatch[1]);
    result.field_confidences.paid_amount = 0.75;
  } else {
    const labelMatch = raw_text.match(AMOUNT_LABEL_RE);
    if (labelMatch) {
      result.paid_amount = normalizeAmount(labelMatch[1]);
      result.field_confidences.paid_amount = 0.7;
    }
  }

  // Payment mode: delegate to existing paymentModeDetector.js
  const modeResult = detectPaymentMode(raw_text);
  result.payment_mode = modeResult.mode;
  result.field_confidences.payment_mode = modeResult.confidence;

  // Overall confidence: average of field confidences, weighted by OCR confidence
  const confValues = Object.values(result.field_confidences);
  result.confidence = confValues.length > 0
    ? (confValues.reduce((a, b) => a + b, 0) / confValues.length) * ocrConfidence
    : 0;

  return result;
}
