/**
 * Payment mode auto-detection from OCR-extracted text.
 * Uses case-insensitive pattern matching ordered by specificity.
 */

const PAYMENT_PATTERNS = [
  {
    mode: 'gpay',
    patterns: [/google\s*pay/i, /gpay/i, /\btez\b/i, /googlepay/i],
  },
  {
    mode: 'phonepe',
    patterns: [/phone\s*pe/i, /phonepe/i],
  },
  {
    mode: 'paytm',
    patterns: [/paytm/i, /pay\s*tm/i],
  },
  {
    mode: 'neft',
    patterns: [/\bneft\b/i, /national\s*electronic/i],
  },
  {
    mode: 'rtgs',
    patterns: [/\brtgs\b/i, /real\s*time\s*gross/i],
  },
  {
    mode: 'card',
    patterns: [/debit\s*card/i, /credit\s*card/i, /\bvisa\b/i, /\bmastercard\b/i, /\brupay\b/i],
  },
];

/**
 * Detect payment mode from OCR text.
 * @param {string} text - Full OCR text from payment screenshot
 * @returns {{ mode: string, confidence: number }}
 *   mode: one of 'gpay', 'phonepe', 'paytm', 'neft', 'rtgs', 'card', 'other'
 *   confidence: 1.0 for pattern matches, 0.5 for 'other'
 */
export function detectPaymentMode(text) {
  if (!text) return { mode: 'other', confidence: 0.5 };

  for (const { mode, patterns } of PAYMENT_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return { mode, confidence: 1.0 };
      }
    }
  }

  // Contextual bank transfer detection: IFSC + Beneficiary Bank = NEFT
  const hasIfsc = /\bifsc\b/i.test(text);
  const hasBeneficiary = /beneficiary/i.test(text);
  const hasDebitAccount = /debit\s*account/i.test(text);
  const hasCreditAccount = /credit\s*account/i.test(text);

  if (
    (hasIfsc && hasBeneficiary) ||
    (hasDebitAccount && hasCreditAccount) ||
    (hasIfsc && hasDebitAccount)
  ) {
    return { mode: 'neft', confidence: 0.7 };
  }

  // Contextual UPI receipt detection: PhonePe receipts have recognizable structure
  // but the "PhonePe" text is only in the logo (image), not OCR-readable.
  const hasTransactionSuccessful = /transaction\s*successful/i.test(text);
  const hasPaidTo = /paid\s*to/i.test(text);
  const hasDebitedFrom = /debited\s*from/i.test(text);
  const hasUtr = /\butr\b/i.test(text);
  const hasPoweredBy = /powered\s*by/i.test(text);

  if (
    (hasTransactionSuccessful && hasPaidTo && hasDebitedFrom) ||
    (hasPaidTo && hasDebitedFrom && hasUtr) ||
    (hasTransactionSuccessful && hasPaidTo && hasPoweredBy)
  ) {
    return { mode: 'phonepe', confidence: 0.7 };
  }

  return { mode: 'other', confidence: 0.5 };
}
