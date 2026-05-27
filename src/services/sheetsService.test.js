import { describe, it, expect } from 'vitest';
import { computeCompositeKey, HEADER_ROW } from './sheetsService';

describe('computeCompositeKey', () => {
  it('joins trader_name, invoice_number, bill_date with pipe separator', () => {
    expect(computeCompositeKey('Store A', 'INV-123', '2026-05-15')).toBe(
      'store a|inv-123|2026-05-15',
    );
  });

  it('lowercases and trims trader_name and invoice_number', () => {
    expect(computeCompositeKey('  Store A  ', '  INV-123  ', '2026-05-15')).toBe(
      'store a|inv-123|2026-05-15',
    );
  });

  it('handles empty string values', () => {
    expect(computeCompositeKey('', '', '')).toBe('||');
  });

  it('handles null values', () => {
    expect(computeCompositeKey(null, null, null)).toBe('||');
  });
});

describe('HEADER_ROW', () => {
  it('has exactly 33 columns', () => {
    expect(HEADER_ROW).toHaveLength(33);
  });

  it('starts with record_id', () => {
    expect(HEADER_ROW[0]).toBe('record_id');
  });

  it('includes all critical fields', () => {
    expect(HEADER_ROW).toContain('trader_name');
    expect(HEADER_ROW).toContain('bill_amount');
    expect(HEADER_ROW).toContain('payment_mode');
    expect(HEADER_ROW).toContain('utr_number');
    expect(HEADER_ROW).toContain('composite_key');
    expect(HEADER_ROW).toContain('upi_transaction_id');
    expect(HEADER_ROW).toContain('google_transaction_id');
  });
});
