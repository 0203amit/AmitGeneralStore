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
    mode: 'net_banking',
    patterns: [/net\s*banking/i, /\bneft\b/i, /\brtgs\b/i, /\bimps\b/i, /internet\s*banking/i, /bank\s*transfer/i],
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
 *   mode: one of 'gpay', 'phonepe', 'paytm', 'net_banking', 'card', 'other'
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

  return { mode: 'other', confidence: 0.5 };
}
