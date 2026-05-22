/**
 * Google Sheets API v4 service for spreadsheet provisioning and record operations.
 * Uses gapi.client.sheets for all Sheets operations.
 */
import { SHEET_NAME, SHEET_WORKSHEET } from '../config/branding';

/** All 33 column headers in sheet order (A through AG). */
export const HEADER_ROW = [
  'record_id',
  'created_at',
  'updated_at',
  'status',
  'archived_at',
  'archived_reason',
  'trader_name',
  'trader_address',
  'invoice_number',
  'bill_date',
  'bill_amount',
  'currency',
  'composite_key',
  'utr_number',
  'payment_date',
  'payment_mode',
  'paid_amount',
  'payer_name',
  'payee_name',
  'bill_image_file_id',
  'bill_image_url',
  'payment_image_file_id',
  'payment_image_url',
  'bill_ocr_confidence',
  'payment_ocr_confidence',
  'needs_review',
  'edit_count',
  'last_edited_field',
  'last_edited_at',
  'notes',
  'tags',
  'upi_transaction_id',
  'google_transaction_id',
];

let cachedSpreadsheetId = null;

/**
 * Ensure the app's spreadsheet exists with the correct structure.
 * Creates the spreadsheet, a "records" worksheet, and a 33-column header
 * row idempotently. Safe to call on every sign-in.
 * @returns {Promise<string>} The spreadsheet ID
 * @throws {Error} If Drive search or Sheets creation fails
 */
export async function ensureAppSheet() {
  if (cachedSpreadsheetId) return cachedSpreadsheetId;

  // Search for an existing spreadsheet by name via Drive API
  const searchResponse = await window.gapi.client.drive.files.list({
    q: `name='${SHEET_NAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });

  const files = searchResponse.result.files;
  if (files && files.length > 0) {
    cachedSpreadsheetId = files[0].id;

    // Migrate: extend header row if existing sheet has fewer columns than expected
    try {
      const headerResp = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: cachedSpreadsheetId,
        range: `${SHEET_WORKSHEET}!1:1`,
      });
      const existingHeader = headerResp.result.values?.[0] || [];
      if (existingHeader.length < HEADER_ROW.length) {
        await window.gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId: cachedSpreadsheetId,
          range: `${SHEET_WORKSHEET}!A1:AG1`,
          valueInputOption: 'RAW',
          resource: { values: [HEADER_ROW] },
        });
      }
    } catch {
      // Non-critical: header migration may fail for permissions, ignore
    }

    return cachedSpreadsheetId;
  }

  // Create a new spreadsheet with a "records" worksheet
  const createResponse = await window.gapi.client.sheets.spreadsheets.create({
    resource: {
      properties: { title: SHEET_NAME },
      sheets: [{ properties: { title: SHEET_WORKSHEET } }],
    },
  });

  cachedSpreadsheetId = createResponse.result.spreadsheetId;

  // Write the header row (A1:AG1)
  await window.gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: cachedSpreadsheetId,
    range: `${SHEET_WORKSHEET}!A1:AG1`,
    valueInputOption: 'RAW',
    resource: { values: [HEADER_ROW] },
  });

  return cachedSpreadsheetId;
}

/**
 * Return the cached spreadsheet ID, or null if not yet provisioned.
 * @returns {string|null}
 */
export function getSpreadsheetId() {
  return cachedSpreadsheetId;
}

/**
 * Clear the cached spreadsheet ID. Called on sign-out.
 */
export function clearSheetCache() {
  cachedSpreadsheetId = null;
}

/**
 * Compute the composite key for duplicate detection.
 * Format: lowercase(trim(trader_name))|lowercase(trim(invoice_number))|bill_date
 * @param {string} traderName
 * @param {string} invoiceNumber
 * @param {string} billDate - YYYY-MM-DD string
 * @returns {string}
 */
export function computeCompositeKey(traderName, invoiceNumber, billDate) {
  return [
    (traderName || '').trim().toLowerCase(),
    (invoiceNumber || '').trim().toLowerCase(),
    (billDate || '').trim(),
  ].join('|');
}

/**
 * Append a new record as a row in the Sheet.
 * Maps the record object to a column-ordered array using HEADER_ROW.
 * @param {Object} record - Object with keys matching HEADER_ROW field names
 * @returns {Promise<void>}
 * @throws {Error} If Sheets API append fails
 */
export async function appendRecord(record) {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) throw new Error('Spreadsheet not provisioned');

  const row = HEADER_ROW.map((col) => {
    const value = record[col];
    if (value === null || value === undefined) return '';
    return String(value);
  });

  await window.gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_WORKSHEET}!A:AG`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    resource: { values: [row] },
  });
}

/**
 * Update a record's row in the Sheet by record_id.
 * Finds the row via getAllRecords() _rowIndex, then overwrites it with the full
 * updated record object mapped to column order.
 * @param {string} recordId - The record_id to locate
 * @param {Object} updatedRecord - Full record object with all field values
 * @returns {Promise<void>}
 * @throws {Error} If record not found or Sheets API update fails
 */
export async function updateRecord(recordId, updatedRecord) {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) throw new Error('Spreadsheet not provisioned');

  const records = await getAllRecords();
  const existing = records.find((r) => r.record_id === recordId);
  if (!existing) throw new Error('Record not found');

  const row = HEADER_ROW.map((col) => {
    const value = updatedRecord[col];
    if (value === null || value === undefined) return '';
    return String(value);
  });

  await window.gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_WORKSHEET}!A${existing._rowIndex}:AG${existing._rowIndex}`,
    valueInputOption: 'RAW',
    resource: { values: [row] },
  });
}

/**
 * Archive a record by setting its status to 'archived'.
 * Sets archived_at to current timestamp and optional archived_reason.
 * @param {string} recordId - The record_id to archive
 * @param {string} [reason=''] - Optional reason for archiving
 * @returns {Promise<Object>} The updated record object
 * @throws {Error} If record not found, already archived, or Sheets API fails
 */
export async function archiveRecord(recordId, reason = '') {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) throw new Error('Spreadsheet not provisioned');

  const records = await getAllRecords();
  const existing = records.find((r) => r.record_id === recordId);
  if (!existing) throw new Error('Record not found');
  if (existing.status === 'archived') throw new Error('Record is already archived');

  const now = new Date().toISOString();
  const updated = {
    ...existing,
    status: 'archived',
    archived_at: now,
    archived_reason: reason,
    updated_at: now,
  };

  const { _rowIndex, ...recordData } = updated;

  const row = HEADER_ROW.map((col) => {
    const value = recordData[col];
    if (value === null || value === undefined) return '';
    return String(value);
  });

  await window.gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_WORKSHEET}!A${existing._rowIndex}:AG${existing._rowIndex}`,
    valueInputOption: 'RAW',
    resource: { values: [row] },
  });

  return updated;
}

/**
 * Restore an archived record by setting its status back to 'active'.
 * Preserves archived_at and archived_reason for audit trail.
 * @param {string} recordId - The record_id to restore
 * @returns {Promise<Object>} The updated record object
 * @throws {Error} If record not found, not archived, or Sheets API fails
 */
export async function restoreRecord(recordId) {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) throw new Error('Spreadsheet not provisioned');

  const records = await getAllRecords();
  const existing = records.find((r) => r.record_id === recordId);
  if (!existing) throw new Error('Record not found');
  if (existing.status !== 'archived') throw new Error('Record is not archived');

  const now = new Date().toISOString();
  const updated = {
    ...existing,
    status: 'active',
    updated_at: now,
  };

  const { _rowIndex, ...recordData } = updated;

  const row = HEADER_ROW.map((col) => {
    const value = recordData[col];
    if (value === null || value === undefined) return '';
    return String(value);
  });

  await window.gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_WORKSHEET}!A${existing._rowIndex}:AG${existing._rowIndex}`,
    valueInputOption: 'RAW',
    resource: { values: [row] },
  });

  return updated;
}

/**
 * Fetch all records from the Sheet, mapping each row to an object.
 * Skips the header row. Tracks row indices for future update operations.
 * @returns {Promise<Array<Object & { _rowIndex: number }>>}
 *   Each object has keys from HEADER_ROW, plus _rowIndex (1-based sheet row number).
 * @throws {Error} If Sheets API read fails
 */
export async function getAllRecords() {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) throw new Error('Spreadsheet not provisioned');

  const response = await window.gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_WORKSHEET}!A:AG`,
  });

  const rows = response.result.values;
  if (!rows || rows.length <= 1) return [];

  const header = rows[0];
  const records = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const record = { _rowIndex: i + 1 };
    for (let j = 0; j < header.length; j++) {
      record[header[j]] = row[j] || '';
    }
    records.push(record);
  }

  return records;
}
