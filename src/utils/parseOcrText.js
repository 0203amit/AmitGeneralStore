/**
 * Parse plain-text OCR output (from Tesseract.js) into app field shapes.
 * Uses regex patterns to extract structured fields from raw text,
 * with confidence scoring and value normalization.
 */

import { detectPaymentMode } from './paymentModeDetector';

// ── Bill extraction patterns ────────────────────────────────────────

/** Invoice number patterns: INV-XXX, BL-XXX, BILL-XXX, or near common labels.
 *  Handles periods after label words (e.g., "Inv. No.", "Bill. No.") and
 *  Indian-specific labels (Challan, Memo, Voucher, Slip). */
const INVOICE_LABEL_RE =
  /(?:inv(?:oice)?\.?\s*(?:no\.?|number|#)|bill\.?\s*(?:no\.?|number|#)|receipt\.?\s*(?:no\.?|number|#)|challan\.?\s*(?:no\.?|number|#)|memo\.?\s*(?:no\.?|number|#)|voucher\.?\s*(?:no\.?|number|#)|slip\.?\s*(?:no\.?|number|#))[.:;\s]*([A-Za-z0-9\-/]+)/i;
const INVOICE_STANDALONE_RE = /\b(INV|BL|BILL|CH|CHL|MEM|VCH)[\s.-]*(\d{1,6})\b/i;

/** Date patterns: DD/MM/YY, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY */
const DATE_RE = /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/;

/** Text date pattern: DD MMM YYYY (e.g., "11 May 2026" or "11 May, 2026") */
const DATE_TEXT_RE =
  /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*[\s,]+(\d{4})\b/i;

/** Amount patterns: after ₹ symbol, or near "Total", "Net Bill", "Amount", "Grand Total" */
const AMOUNT_RUPEE_RE = /₹\s*([\d,]+\.?\d*)/;
const AMOUNT_LABEL_RE =
  /(?:total|net\s*bill|grand\s*total|net\s*amount|amount)[.:;\s]*(?:₹|Rs\.?|INR)?\s*([\d,]+\.?\d*)/i;

/** Misread ₹: Tesseract eng often reads ₹ as Z, t, F, f, or €.
 *  Match a misread-char immediately before a comma-formatted Indian number (e.g., "Z4,250"). */
const AMOUNT_RUPEE_MISREAD_RE =
  /(?:^|[\s\n])([ZzTtFf€])[\s]{0,2}([\d]{1,2},\d{3}(?:,\d{2,3})*\.?\d*)/m;

/** ₹ misread as "2" near an amount label: "Transaction Amount\n21,966.00" → strips leading "2".
 *  Only matches when "2" precedes a comma-formatted number (X,XXX) after a known amount label. */
const AMOUNT_LABEL_RUPEE2_RE =
  /(?:transaction\s*amount|total\s*amount|paid\s*amount|net\s*amount|amount)[.:;\s]*2\s*([\d]{1,2},\d{3}(?:,\d{2,3})*\.?\d*)/i;

/** Standalone amount on its own line (fallback — accepts amounts without decimals) */
const AMOUNT_STANDALONE_RE = /(?:^|\n)\s*[₹R]?\s*([\d,]+\.?\d{0,2})\s*(?:\n|$)/m;

// ── Payment extraction patterns ─────────────────────────────────────

/** UTR number: 12-digit number near "UTR" label, or standalone 12-22 digit number */
const UTR_LABEL_RE = /(?:utr|ref(?:erence)?(?:\s*(?:no|number|id|#))?)[.:;\s]*(\d{12,22})/i;
const UTR_STANDALONE_RE = /\b(\d{12,22})\b/;

// ── Bank transfer extraction patterns ────────────────────────────
const DEBIT_ACCOUNT_RE = /debit\s*account\s*(?:number|no\.?|#)?[.:;\s]*([A-Za-z0-9X]+)/i;
const CREDIT_ACCOUNT_RE = /credit\s*account\s*(?:number|no\.?|#)?[.:;\s]*([A-Za-z0-9X]+)/i;
const IFSC_RE = /\bifsc\b(?:\s*code)?[.:;\s]*([A-Z0-9]{4}[0O][A-Z0-9]{6})/i;

// ── GPay-specific extraction patterns ──────────────────────────────
const UPI_TXN_ID_RE = /upi\s*transaction\s*id[.:;\s]*([A-Za-z0-9]+)/i;
const GOOGLE_TXN_ID_RE = /google\s*transaction\s*id[.:;\s]*([A-Za-z0-9]+)/i;
const PAYEE_NAME_RE = /(?:paid\s*to|(?:^|\n)\s*to)\s+([^\n]+)/im;
const PAYER_NAME_RE = /(?:paid\s*(?:by|from)|debited\s*from|(?:^|\n)\s*from)[.:;\s]+([^\n]+)/im;
/** UPI ID pattern: user@bank (e.g., amitgupta030794-2@okaxis) */
const UPI_ID_RE = /[\w.-]+@[a-z]+/i;

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
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12',
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

  const lines = raw_text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // Trader name: scan first 6 lines, skipping common headers and junk.
  // Indian trade bills have the business name at the top in bold, but OCR often
  // reads header text ("TAX INVOICE"), phone numbers, or GSTIN before it.
  const HEADER_SKIP_RE =
    /^(?:tax\s*invoice|invoice|cash\s*memo|retail\s*invoice|wholesale\s*invoice|proforma\s*invoice|estimate|quotation|delivery\s*challan|credit\s*note|debit\s*note|bill\s*of\s*supply|receipt|original|duplicate|triplicate|copy|subject\s*to|e\s*&\s*o\.?\s*e\.?|goods\s*once\s*sold|terms?\s*(?:&|and)\s*conditions?)$/i;
  const JUNK_LINE_RE =
    /^(?:\+?\d[\d\s\-().]{6,}|(?:ph|phone|mob|mobile|tel|fax)[.:;\s]*\d|(?:gstin?|gst\s*no|pan)[.:;\s]*[A-Z0-9]|[\W\d]{1,4}|www\.|http)/i;

  let traderNameFound = false;
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const line = lines[i].trim();
    if (line.length < 3) continue; // skip OCR artifacts
    if (!/[A-Za-z]/.test(line)) continue; // must contain a letter
    if (HEADER_SKIP_RE.test(line)) continue; // skip document type headers
    if (JUNK_LINE_RE.test(line)) continue; // skip phone/GSTIN/junk
    if (/^[\s\W]+$/.test(line)) continue; // skip pure punctuation

    result.trader_name = line;
    result.field_confidences.trader_name = i <= 1 ? 0.7 : 0.6;
    traderNameFound = true;
    break;
  }
  // Fallback: use first line with low confidence if nothing passed filters
  if (!traderNameFound && lines.length > 0) {
    result.trader_name = lines[0];
    result.field_confidences.trader_name = 0.4;
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

  // Bill amount: multi-tier extraction prioritizing labeled totals over raw ₹.
  // Indian trade bills have ₹ on every line item, so raw ₹ grabs the wrong amount.
  // The actual total is always labeled (e.g., "Net Bill", "Grand Total").

  // Tier 1: Specific total labels — definitive totals on Indian bills
  const netBillMatch = raw_text.match(
    /(?:net\s*bill|grand\s*total|net\s*(?:payable|amount)|total\s*(?:payable|amount\s*due)|balance\s*(?:due|payable)|amount\s*payable|bill\s*amount|final\s*amount|net\s*total)[.:;\s]*(?:₹|Rs\.?|INR|[ZzTtFf€])?\s*([\d,]+\.?\d*)/i,
  );
  if (netBillMatch) {
    const val = parseFloat(netBillMatch[1].replace(/,/g, ''));
    if (val >= 1) {
      result.bill_amount = normalizeAmount(netBillMatch[1]);
      result.field_confidences.bill_amount = 0.85;
    }
  }

  // Tier 2: Generic "Total" label (skip "Total Qty", "Total Items", etc.)
  if (!result.bill_amount) {
    const totalLabelMatch = raw_text.match(
      /(?:total)(?!\s*(?:qty|quantity|items?|pieces?|pcs|units?|wt|weight|no|number|disc))[.:;\s]*(?:₹|Rs\.?|INR|[ZzTtFf€])?\s*([\d,]+\.?\d*)/i,
    );
    if (totalLabelMatch) {
      result.bill_amount = normalizeAmount(totalLabelMatch[1]);
      result.field_confidences.bill_amount = 0.75;
    }
  }

  // Tier 3: Last ₹ amount in document (totals appear at the bottom of bills)
  if (!result.bill_amount) {
    const allRupeeMatches = [...raw_text.matchAll(/₹\s*([\d,]+\.?\d*)/g)];
    if (allRupeeMatches.length > 0) {
      const lastMatch = allRupeeMatches[allRupeeMatches.length - 1];
      result.bill_amount = normalizeAmount(lastMatch[1]);
      result.field_confidences.bill_amount = 0.65;
    }
  }

  // Tier 4: Misread rupee prefix (Z, t, F, f, € before comma-formatted number)
  if (!result.bill_amount) {
    const misreadMatch = raw_text.match(AMOUNT_RUPEE_MISREAD_RE);
    if (misreadMatch) {
      result.bill_amount = normalizeAmount(misreadMatch[2]);
      result.field_confidences.bill_amount = 0.6;
    }
  }

  // Tier 5: Standalone number on own line (relaxed, min value >= 100)
  if (!result.bill_amount) {
    const standaloneMatch = raw_text.match(AMOUNT_STANDALONE_RE);
    if (standaloneMatch) {
      const val = parseFloat(standaloneMatch[1].replace(/,/g, ''));
      if (val >= 100) {
        result.bill_amount = normalizeAmount(standaloneMatch[1]);
        result.field_confidences.bill_amount = 0.5;
      }
    }
  }

  // Currency: always INR for this app
  result.field_confidences.currency = 1.0;

  // Overall confidence: average of field confidences, weighted by OCR confidence
  const confValues = Object.values(result.field_confidences);
  const avgFieldConf =
    confValues.length > 0 ? confValues.reduce((a, b) => a + b, 0) / confValues.length : 0;
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
 *   upi_transaction_id: string, google_transaction_id: string,
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
    upi_transaction_id: '',
    google_transaction_id: '',
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

  // Payment date: numeric format first, then text month format as fallback
  const dateMatch = raw_text.match(DATE_RE);
  if (dateMatch) {
    result.payment_date = normalizeDate(dateMatch[0]);
    result.field_confidences.payment_date = 0.7;
  } else {
    const dateTextMatch = raw_text.match(DATE_TEXT_RE);
    if (dateTextMatch) {
      result.payment_date = normalizeDate(dateTextMatch[0]);
      result.field_confidences.payment_date = 0.7;
    }
  }

  // Payment mode: detect early so we can use it for app-specific amount extraction
  const modeResult = detectPaymentMode(raw_text);
  result.payment_mode = modeResult.mode;
  result.field_confidences.payment_mode = modeResult.confidence;

  // Paid amount: 5-tier cascade for robust extraction
  // Tier 1: Actual ₹ symbol in OCR output
  const rupeeMatch = raw_text.match(AMOUNT_RUPEE_RE);
  if (rupeeMatch) {
    result.paid_amount = normalizeAmount(rupeeMatch[1]);
    result.field_confidences.paid_amount = 0.8;
  }

  // Tier 2: Misread rupee prefix (Z, t, F, f, € before a comma-formatted number)
  if (!result.paid_amount) {
    const misreadMatch = raw_text.match(AMOUNT_RUPEE_MISREAD_RE);
    if (misreadMatch) {
      result.paid_amount = normalizeAmount(misreadMatch[2]);
      result.field_confidences.paid_amount = 0.7;
    }
  }

  // Tier 3: Label with ₹→2 misread ("Transaction Amount\n21,966" → strips leading "2")
  if (!result.paid_amount) {
    const label2Match = raw_text.match(AMOUNT_LABEL_RUPEE2_RE);
    if (label2Match) {
      result.paid_amount = normalizeAmount(label2Match[1]);
      result.field_confidences.paid_amount = 0.65;
    }
  }

  // Tier 4: Label-based ("Total", "Amount", etc.)
  if (!result.paid_amount) {
    const labelMatch = raw_text.match(AMOUNT_LABEL_RE);
    if (labelMatch) {
      result.paid_amount = normalizeAmount(labelMatch[1]);
      result.field_confidences.paid_amount = 0.7;
    }
  }

  // Tier 5: UPI receipt — comma-formatted number AFTER "Paid to" text
  // PhonePe layout: "Paid to\n[Name]  ₹X,XXX" — amount is on the payee line
  if (!result.paid_amount && /paid\s*to/i.test(raw_text)) {
    const paidToMatch = raw_text.match(/paid\s*to/i);
    if (paidToMatch) {
      const afterPaidTo = raw_text.substring(
        paidToMatch.index + paidToMatch[0].length,
        paidToMatch.index + paidToMatch[0].length + 300,
      );
      // Find comma-formatted amounts (X,XXX pattern) in the text after "Paid to"
      const amountMatches = [...afterPaidTo.matchAll(/([\d]{1,2},\d{3}(?:,\d{2,3})*\.?\d*)/g)];
      if (amountMatches.length > 0) {
        result.paid_amount = normalizeAmount(amountMatches[0][1]);
        result.field_confidences.paid_amount = 0.75;
      }
    }
  }

  // Tier 6: Amount near "Debited from" — PhonePe shows ₹X,XXX next to the bank account
  if (!result.paid_amount && /debit/i.test(raw_text)) {
    const debitMatch = raw_text.match(/debit(?:ed)?\s*(?:from)?/i);
    if (debitMatch) {
      const nearDebit = raw_text.substring(debitMatch.index, debitMatch.index + 200);
      const amountMatches = [...nearDebit.matchAll(/([\d]{1,2},\d{3}(?:,\d{2,3})*\.?\d*)/g)];
      if (amountMatches.length > 0) {
        result.paid_amount = normalizeAmount(amountMatches[0][1]);
        result.field_confidences.paid_amount = 0.7;
      }
    }
  }

  // Tier 7: Standalone number on its own line (relaxed, min value >= 100, not a date)
  if (!result.paid_amount) {
    const standaloneMatch = raw_text.match(AMOUNT_STANDALONE_RE);
    if (standaloneMatch) {
      const val = parseFloat(standaloneMatch[1].replace(/,/g, ''));
      // Skip if this looks like a year (1900-2099) near a month name
      const isYearLike =
        val >= 1900 &&
        val <= 2099 &&
        /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*/i.test(raw_text);
      if (val >= 100 && !isYearLike) {
        result.paid_amount = normalizeAmount(standaloneMatch[1]);
        result.field_confidences.paid_amount = 0.55;
      }
    }
  }

  // GPay-specific fields: extract UPI and Google transaction IDs
  if (result.payment_mode === 'gpay') {
    const upiMatch = raw_text.match(UPI_TXN_ID_RE);
    if (upiMatch) {
      result.upi_transaction_id = upiMatch[1].trim();
      result.field_confidences.upi_transaction_id = 0.8;
    }

    const googleMatch = raw_text.match(GOOGLE_TXN_ID_RE);
    if (googleMatch) {
      result.google_transaction_id = googleMatch[1].trim();
      result.field_confidences.google_transaction_id = 0.8;
    }

    // For GPay, try extracting payee from "To [Name]" pattern + UPI ID
    const payeeMatch = raw_text.match(PAYEE_NAME_RE);
    if (payeeMatch && !result.payee_name) {
      let payeeName = payeeMatch[1].trim();
      // Look for UPI ID on the same or subsequent lines
      const payeeIdx = raw_text.indexOf(payeeMatch[0]);
      const afterPayee = raw_text.substring(
        payeeIdx + payeeMatch[0].length,
        payeeIdx + payeeMatch[0].length + 200,
      );
      const upiIdMatch = afterPayee.match(UPI_ID_RE);
      if (upiIdMatch) {
        payeeName += ' ' + upiIdMatch[0];
      }
      result.payee_name = payeeName;
      result.field_confidences.payee_name = 0.65;
    }

    // For GPay, try extracting payer from "From [Name]" or "From: [Name]" pattern + bank + UPI ID
    const payerMatch = raw_text.match(PAYER_NAME_RE);
    // Fallback 1: broader word-boundary match (allows colon after "from")
    const payerFallbackMatch = !payerMatch ? raw_text.match(/\bfrom[.:;\s]+([^\n]+)/im) : null;
    // Fallback 2: mid-line "From:" without word boundary (OCR joins words, e.g., "hdfcbankFrom:")
    const payerMidlineMatch =
      !payerMatch && !payerFallbackMatch ? raw_text.match(/[Ff]rom[.:;]\s*([^\n]+)/m) : null;
    const effectivePayerMatch = payerMatch || payerFallbackMatch || payerMidlineMatch;
    if (effectivePayerMatch && !result.payer_name) {
      let payerName = effectivePayerMatch[1].trim();
      // Look for bank name in parentheses and UPI ID on subsequent lines
      const payerIdx = raw_text.indexOf(effectivePayerMatch[0]);
      const afterPayer = raw_text.substring(
        payerIdx + effectivePayerMatch[0].length,
        payerIdx + effectivePayerMatch[0].length + 300,
      );
      // Capture bank name in parentheses like "(State Bank of India)"
      const bankMatch = afterPayer.match(/\(([^)]+)\)/);
      if (bankMatch) {
        payerName += ' (' + bankMatch[1] + ')';
      }
      // Capture UPI ID
      const upiIdMatch = afterPayer.match(UPI_ID_RE);
      if (upiIdMatch) {
        payerName += ' ' + upiIdMatch[0];
      }
      result.payer_name = payerName;
      result.field_confidences.payer_name = payerMatch ? 0.65 : 0.55;
    }
  }

  // Bank transfer receipts: extract account numbers + IFSC / bank name as payer/payee
  if (result.payment_mode === 'neft' || result.payment_mode === 'rtgs') {
    // Payee = Credit Account Number + IFSC
    const creditMatch = raw_text.match(CREDIT_ACCOUNT_RE);
    if (creditMatch && !result.payee_name) {
      const parts = [creditMatch[1].trim()];
      const ifscMatch = raw_text.match(IFSC_RE);
      if (ifscMatch) parts.push(ifscMatch[1].trim().toUpperCase());
      result.payee_name = parts.join(', ');
      result.field_confidences.payee_name = 0.75;
    }

    // Payer = known account name (matched by last 4 digits), or Debit Account Number
    // OCR often misreads masked account numbers (XXXXXXXXXXXX4501 → "XX"), so we
    // match on the last 4 digits which are the most reliably read.
    const KNOWN_PAYER_ACCOUNTS = {
      4501: 'Amit General Store KBL',
    };
    const debitMatch = raw_text.match(DEBIT_ACCOUNT_RE);
    if (debitMatch && !result.payer_name) {
      const acctNum = debitMatch[1].trim();
      const last4 = acctNum.replace(/[^0-9]/g, '').slice(-4);
      const knownName = last4.length === 4 ? KNOWN_PAYER_ACCOUNTS[last4] : null;
      if (knownName) {
        result.payer_name = knownName;
        result.field_confidences.payer_name = 1.0;
      } else {
        const parts = [acctNum];
        const firstLine = raw_text
          .split('\n')
          .map((l) => l.trim())
          .find((l) => l.length > 1);
        if (firstLine) parts.push(firstLine);
        result.payer_name = parts.join(', ');
        result.field_confidences.payer_name = 0.75;
      }
    }
  }

  // Overall confidence: average of field confidences, weighted by OCR confidence
  const confValues = Object.values(result.field_confidences);
  result.confidence =
    confValues.length > 0
      ? (confValues.reduce((a, b) => a + b, 0) / confValues.length) * ocrConfidence
      : 0;

  return result;
}
