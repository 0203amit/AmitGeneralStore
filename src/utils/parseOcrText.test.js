import { describe, it, expect } from 'vitest';
import { normalizeDate, normalizeAmount, parseBillText, parsePaymentText } from './parseOcrText';

describe('normalizeDate', () => {
  it('returns empty string for falsy input', () => {
    expect(normalizeDate('')).toBe('');
    expect(normalizeDate(null)).toBe('');
    expect(normalizeDate(undefined)).toBe('');
  });

  it('passes through already-normalized YYYY-MM-DD', () => {
    expect(normalizeDate('2026-05-15')).toBe('2026-05-15');
  });

  it('converts DD/MM/YYYY to YYYY-MM-DD', () => {
    expect(normalizeDate('15/05/2026')).toBe('2026-05-15');
  });

  it('converts DD-MM-YYYY to YYYY-MM-DD', () => {
    expect(normalizeDate('15-05-2026')).toBe('2026-05-15');
  });

  it('converts DD.MM.YYYY to YYYY-MM-DD', () => {
    expect(normalizeDate('15.05.2026')).toBe('2026-05-15');
  });

  it('handles DD/MM/YY with 2-digit year (00-50 -> 20xx)', () => {
    expect(normalizeDate('15/05/26')).toBe('2026-05-15');
  });

  it('handles DD/MM/YY with 2-digit year (51-99 -> 19xx)', () => {
    expect(normalizeDate('15/05/95')).toBe('1995-05-15');
  });

  it('converts "DD MMM YYYY" text format', () => {
    expect(normalizeDate('15 May 2026')).toBe('2026-05-15');
    expect(normalizeDate('1 January 2026')).toBe('2026-01-01');
  });

  it('pads single-digit day and month', () => {
    expect(normalizeDate('5/3/2026')).toBe('2026-03-05');
  });

  it('returns original string for unparseable input', () => {
    expect(normalizeDate('not-a-date')).toBe('not-a-date');
  });
});

describe('normalizeAmount', () => {
  it('returns empty string for falsy input', () => {
    expect(normalizeAmount('')).toBe('');
    expect(normalizeAmount(null)).toBe('');
  });

  it('strips rupee symbol', () => {
    expect(normalizeAmount('₹4,250.00')).toBe('4250.00');
  });

  it('strips Rs. prefix', () => {
    expect(normalizeAmount('Rs. 1,500')).toBe('1500');
  });

  it('strips INR prefix', () => {
    expect(normalizeAmount('INR 3000')).toBe('3000');
  });

  it('strips commas from Indian number format', () => {
    expect(normalizeAmount('1,25,000.50')).toBe('125000.50');
  });

  it('strips whitespace', () => {
    expect(normalizeAmount(' 4 250 ')).toBe('4250');
  });
});

describe('parseBillText', () => {
  it('returns default structure for empty text', () => {
    const result = parseBillText('', 0.8);
    expect(result).toMatchObject({
      trader_name: '',
      invoice_number: '',
      bill_date: '',
      bill_amount: '',
      currency: 'INR',
      raw_text: '',
    });
    // currency confidence is always 1.0, so confidence = 1.0 * 0.8 = 0.8
    expect(result.confidence).toBe(0.8);
  });

  it('extracts trader name from first non-header line', () => {
    const text = 'TAX INVOICE\nAmit General Store\nGSTIN: 07AABCU0000A1Z5';
    const result = parseBillText(text, 0.8);
    expect(result.trader_name).toBe('Amit General Store');
  });

  it('skips phone numbers and GSTIN lines for trader name', () => {
    const text = '+91 9876543210\nGSTIN: 07AAB\nDelhi Trading Co\nInv No. 123';
    const result = parseBillText(text, 0.8);
    expect(result.trader_name).toBe('Delhi Trading Co');
  });

  it('extracts labeled invoice number', () => {
    const text = 'Some Store\nInvoice No. INV-4521\nDate: 15/05/2026';
    const result = parseBillText(text, 0.8);
    expect(result.invoice_number).toBe('INV-4521');
  });

  it('extracts bill date in DD/MM/YYYY format and normalizes', () => {
    const text = 'Some Store\nDate: 15/05/2026\nTotal: ₹5000';
    const result = parseBillText(text, 0.8);
    expect(result.bill_date).toBe('2026-05-15');
  });

  it('extracts labeled net bill amount (Tier 1)', () => {
    const text = 'Item 1 ₹1000\nItem 2 ₹2000\nNet Bill: ₹3,000.00';
    const result = parseBillText(text, 0.8);
    expect(result.bill_amount).toBe('3000.00');
  });

  it('extracts generic total label amount (Tier 2)', () => {
    const text = 'Item 1 ₹500\nTotal: 1,500.00';
    const result = parseBillText(text, 0.8);
    expect(result.bill_amount).toBe('1500.00');
  });

  it('uses last rupee amount as fallback (Tier 3)', () => {
    const text = 'Line item ₹500\n₹1000\n₹4,250';
    const result = parseBillText(text, 0.8);
    expect(result.bill_amount).toBe('4250');
  });

  it('handles misread rupee as Z before comma-formatted number (Tier 4)', () => {
    const text = 'Some Store\n Z4,250';
    const result = parseBillText(text, 0.8);
    expect(result.bill_amount).toBe('4250');
  });

  it('computes overall confidence as field average * ocrConfidence', () => {
    const text = 'Store Name\nInv No. 123\n15/05/2026\nNet Bill: ₹5000';
    const result = parseBillText(text, 0.9);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('preserves raw_text in result', () => {
    const text = 'Some Store\nTotal: ₹500';
    const result = parseBillText(text, 0.8);
    expect(result.raw_text).toBe(text);
  });
});

describe('parsePaymentText', () => {
  it('returns default structure for empty text', () => {
    const result = parsePaymentText('', 0.8);
    expect(result).toMatchObject({
      utr_number: '',
      payment_date: '',
      payment_mode: 'other',
      paid_amount: '',
      raw_text: '',
    });
  });

  it('extracts labeled UTR number', () => {
    const text = 'UTR: 123456789012\nAmount: ₹5,000';
    const result = parsePaymentText(text, 0.8);
    expect(result.utr_number).toBe('123456789012');
  });

  it('extracts standalone 12-digit UTR number', () => {
    const text = 'Payment confirmed\n123456789012\nSome text';
    const result = parsePaymentText(text, 0.8);
    expect(result.utr_number).toBe('123456789012');
  });

  it('detects GPay payment mode', () => {
    const text = 'Google Pay\nPaid to Store\n₹1,500';
    const result = parsePaymentText(text, 0.8);
    expect(result.payment_mode).toBe('gpay');
  });

  it('detects PhonePe payment mode', () => {
    const text = 'PhonePe\nTransaction Successful\n₹2,000';
    const result = parsePaymentText(text, 0.8);
    expect(result.payment_mode).toBe('phonepe');
  });

  it('extracts rupee amount from payment text', () => {
    const text = 'NEFT\nAmount ₹4,500.00\nUTR: 123456789012';
    const result = parsePaymentText(text, 0.8);
    expect(result.paid_amount).toBe('4500.00');
  });

  it('extracts payment date', () => {
    const text = 'Payment on 21/05/2026\n₹1,000';
    const result = parsePaymentText(text, 0.8);
    expect(result.payment_date).toBe('2026-05-21');
  });

  it('extracts text-format date (DD MMM YYYY)', () => {
    const text = '11 May 2026\nPaid ₹1,000';
    const result = parsePaymentText(text, 0.8);
    expect(result.payment_date).toBe('2026-05-11');
  });

  it('handles misread rupee as Z in payment amount', () => {
    const text = 'NEFT Transfer\n Z1,966.00\nUTR: 123456789012';
    const result = parsePaymentText(text, 0.8);
    expect(result.paid_amount).toBe('1966.00');
  });

  it('extracts GPay UPI and Google transaction IDs', () => {
    const text =
      'Google Pay\nUPI Transaction ID: ABC123XYZ\nGoogle Transaction ID: GGL456DEF\n₹500';
    const result = parsePaymentText(text, 0.8);
    expect(result.payment_mode).toBe('gpay');
    expect(result.upi_transaction_id).toBe('ABC123XYZ');
    expect(result.google_transaction_id).toBe('GGL456DEF');
  });

  it('extracts NEFT debit account and resolves known payer', () => {
    const text =
      'NEFT\nDebit Account Number: XXXX4501\nCredit Account Number: 12345678\nIFSC Code: SBIN0001234\n₹10,000';
    const result = parsePaymentText(text, 0.8);
    expect(result.payment_mode).toBe('neft');
    expect(result.payer_name).toBe('Amit General Store KBL');
  });

  it('computes confidence from field averages and OCR confidence', () => {
    const text = 'Google Pay\nUTR: 123456789012\n₹500\n15/05/2026';
    const result = parsePaymentText(text, 0.9);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
