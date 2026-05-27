import { describe, it, expect } from 'vitest';
import { detectPaymentMode } from './paymentModeDetector';

describe('detectPaymentMode', () => {
  it('returns "other" with 0.5 confidence for empty/null text', () => {
    expect(detectPaymentMode('')).toEqual({ mode: 'other', confidence: 0.5 });
    expect(detectPaymentMode(null)).toEqual({ mode: 'other', confidence: 0.5 });
  });

  it('detects GPay from "Google Pay" text', () => {
    expect(detectPaymentMode('Google Pay receipt')).toEqual({ mode: 'gpay', confidence: 1.0 });
  });

  it('detects GPay from "GPay" text', () => {
    expect(detectPaymentMode('GPay ₹500')).toEqual({ mode: 'gpay', confidence: 1.0 });
  });

  it('detects GPay from "Tez" text', () => {
    expect(detectPaymentMode('Paid via Tez')).toEqual({ mode: 'gpay', confidence: 1.0 });
  });

  it('detects PhonePe', () => {
    expect(detectPaymentMode('PhonePe transaction')).toEqual({
      mode: 'phonepe',
      confidence: 1.0,
    });
  });

  it('detects Paytm', () => {
    expect(detectPaymentMode('Paytm payment')).toEqual({ mode: 'paytm', confidence: 1.0 });
  });

  it('detects NEFT', () => {
    expect(detectPaymentMode('NEFT Transfer')).toEqual({ mode: 'neft', confidence: 1.0 });
  });

  it('detects RTGS', () => {
    expect(detectPaymentMode('RTGS payment')).toEqual({ mode: 'rtgs', confidence: 1.0 });
  });

  it('detects card payments from Visa', () => {
    expect(detectPaymentMode('Visa debit card')).toEqual({ mode: 'card', confidence: 1.0 });
  });

  it('detects card payments from RuPay', () => {
    expect(detectPaymentMode('RuPay transaction')).toEqual({ mode: 'card', confidence: 1.0 });
  });

  it('detects NEFT contextually from IFSC + Beneficiary', () => {
    const text = 'IFSC: SBIN0001234\nBeneficiary: Some Store';
    expect(detectPaymentMode(text)).toEqual({ mode: 'neft', confidence: 0.7 });
  });

  it('detects NEFT contextually from Debit + Credit Account', () => {
    const text = 'Debit Account: XXXX4501\nCredit Account: 12345678';
    expect(detectPaymentMode(text)).toEqual({ mode: 'neft', confidence: 0.7 });
  });

  it('detects PhonePe contextually from layout patterns', () => {
    const text =
      'Transaction Successful\nPaid to Store\nDebited from HDFC\nUTR: 123456789012';
    expect(detectPaymentMode(text)).toEqual({ mode: 'phonepe', confidence: 0.7 });
  });

  it('returns "other" for unrecognizable text', () => {
    expect(detectPaymentMode('random text with no payment clues')).toEqual({
      mode: 'other',
      confidence: 0.5,
    });
  });
});
