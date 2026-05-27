/**
 * CSV export utility for receipt records.
 * Generates RFC 4180-compliant CSV with all 31 data model columns.
 */
import { format } from 'date-fns';
import { HEADER_ROW } from '../services/sheetsService';
import { CSV_FILENAME_PREFIX } from '../config/branding';

/**
 * Escape a field value for CSV output per RFC 4180.
 * Wraps in double quotes if the value contains commas, double quotes, or newlines.
 * Internal double quotes are escaped by doubling them.
 * @param {*} value
 * @returns {string}
 */
function escapeCsvField(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generate a CSV string from an array of record objects.
 * Uses the 31-column HEADER_ROW from sheetsService for column order.
 * @param {Object[]} records - Array of record objects (keys matching HEADER_ROW)
 * @returns {string} RFC 4180-compliant CSV string
 */
export function generateCsvString(records) {
  const headerLine = HEADER_ROW.map(escapeCsvField).join(',');
  const dataLines = records.map((record) =>
    HEADER_ROW.map((col) => escapeCsvField(record[col])).join(','),
  );
  return [headerLine, ...dataLines].join('\r\n');
}

/**
 * Build a branded CSV filename with the current date.
 * @returns {string} e.g. "amit_general_store_receipts_2026-05-21.csv"
 */
export function buildCsvFilename() {
  return `${CSV_FILENAME_PREFIX}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
}
