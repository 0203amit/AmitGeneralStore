import { describe, it, expect, vi } from 'vitest';

// Mock sheetsService and branding before importing csvExporter
vi.mock('../services/sheetsService', () => ({
  HEADER_ROW: ['record_id', 'trader_name', 'bill_amount', 'notes'],
}));

vi.mock('../config/branding', () => ({
  CSV_FILENAME_PREFIX: 'test_receipts',
}));

const { generateCsvString, buildCsvFilename } = await import('./csvExporter');

describe('generateCsvString', () => {
  it('generates header row from HEADER_ROW', () => {
    const csv = generateCsvString([]);
    expect(csv).toBe('record_id,trader_name,bill_amount,notes');
  });

  it('maps record fields to column order', () => {
    const records = [
      { record_id: 'abc', trader_name: 'Store A', bill_amount: '5000', notes: '' },
    ];
    const csv = generateCsvString(records);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('abc,Store A,5000,');
  });

  it('escapes fields containing commas with double quotes', () => {
    const records = [
      { record_id: '1', trader_name: 'Store A, Branch B', bill_amount: '100', notes: '' },
    ];
    const csv = generateCsvString(records);
    expect(csv).toContain('"Store A, Branch B"');
  });

  it('escapes fields containing double quotes by doubling them', () => {
    const records = [
      { record_id: '1', trader_name: 'Store "Best"', bill_amount: '100', notes: '' },
    ];
    const csv = generateCsvString(records);
    expect(csv).toContain('"Store ""Best"""');
  });

  it('handles null/undefined field values', () => {
    const records = [{ record_id: '1', trader_name: null, bill_amount: undefined }];
    const csv = generateCsvString(records);
    const lines = csv.split('\r\n');
    expect(lines[1]).toBe('1,,,');
  });
});

describe('buildCsvFilename', () => {
  it('returns filename with prefix and current date', () => {
    const filename = buildCsvFilename();
    expect(filename).toMatch(/^test_receipts_\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
