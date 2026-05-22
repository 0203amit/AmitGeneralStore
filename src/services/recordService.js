/**
 * Record orchestration service.
 * Coordinates Drive uploads, Sheets appends, and rollback on failure.
 * Implements atomic save guarantees, duplicate detection, and proof packet generation.
 */
import { v4 as uuidv4 } from 'uuid';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { format } from 'date-fns';
import { uploadImage, deleteImage, getImageBlob } from './driveService';
import { appendRecord, updateRecord, getAllRecords, computeCompositeKey } from './sheetsService';
import { BUSINESS_NAME, PDF_TITLE, PDF_FOOTER, BACKUP_FILENAME_PREFIX } from '../config/branding';
import { formatDisplayDate, formatCurrency } from '../utils/dateHelpers';
import { generateCsvString, buildCsvFilename } from '../utils/csvExporter';

/* ── Private Constants ───────────────────────────────────────────────── */

const PAYMENT_MODE_LABELS = {
  gpay: 'GPay',
  phonepe: 'PhonePe',
  paytm: 'Paytm',
  neft: 'NEFT',
  rtgs: 'RTGS',
  card: 'Card',
  other: 'Other',
  net_banking: 'Net Banking',
};

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 20;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

/* ── Private Helpers ─────────────────────────────────────────────────── */

/** Convert a Blob to a data URL string for jsPDF embedding. */
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Get natural width/height of an image from its data URL. */
function getImageDimensions(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/** Safe field accessor with 'N/A' fallback. */
function field(value) {
  return value || 'N/A';
}

/** Draw a labeled row on the PDF at the given y position. Returns new y. */
function drawLabelValue(doc, label, value, x, y, labelWidth) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(label, x, y);
  doc.setFont('helvetica', 'normal');
  doc.text(String(value), x + labelWidth, y);
  return y + 7;
}

/** Add page footer to the current page. */
function addPageFooter(doc, pageNum, totalPages) {
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(PDF_FOOTER, PAGE_WIDTH / 2, PAGE_HEIGHT - 10, { align: 'center' });
  doc.text(`Page ${pageNum} of ${totalPages}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 10, { align: 'right' });
  doc.setTextColor(0, 0, 0);
}

/** Page 1: Branded cover page with key record fields. */
function addCoverPage(doc, record, generatedAt) {
  let y = MARGIN + 10;

  // Store name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text(BUSINESS_NAME, PAGE_WIDTH / 2, y, { align: 'center' });
  y += 12;

  // PDF title
  doc.setFontSize(18);
  doc.setTextColor(80, 80, 80);
  doc.text(PDF_TITLE, PAGE_WIDTH / 2, y, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y += 10;

  // Horizontal rule
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 15;

  // Key fields
  const labelWidth = 45;
  doc.setFontSize(10);

  y = drawLabelValue(doc, 'Trader:', field(record.trader_name), MARGIN, y, labelWidth);
  if (record.trader_address) {
    y = drawLabelValue(doc, 'Address:', field(record.trader_address), MARGIN, y, labelWidth);
  }
  y = drawLabelValue(doc, 'Invoice No.:', field(record.invoice_number), MARGIN, y, labelWidth);
  y = drawLabelValue(doc, 'Bill Date:', formatDisplayDate(record.bill_date) || 'N/A', MARGIN, y, labelWidth);
  y = drawLabelValue(doc, 'Bill Amount:', record.bill_amount ? `\u20B9${formatCurrency(record.bill_amount)}` : 'N/A', MARGIN, y, labelWidth);
  y = drawLabelValue(doc, 'Currency:', field(record.currency), MARGIN, y, labelWidth);
  y += 5;

  // Payment details
  if (record.payment_mode === 'gpay') {
    y = drawLabelValue(doc, 'UPI Txn ID:', field(record.upi_transaction_id), MARGIN, y, labelWidth);
    y = drawLabelValue(doc, 'Google Txn ID:', field(record.google_transaction_id), MARGIN, y, labelWidth);
  } else {
    y = drawLabelValue(doc, 'UTR Number:', field(record.utr_number), MARGIN, y, labelWidth);
  }
  y = drawLabelValue(doc, 'Payment Date:', formatDisplayDate(record.payment_date) || 'N/A', MARGIN, y, labelWidth);
  y = drawLabelValue(doc, 'Payment Mode:', PAYMENT_MODE_LABELS[record.payment_mode] || field(record.payment_mode), MARGIN, y, labelWidth);
  y = drawLabelValue(doc, 'Paid Amount:', record.paid_amount ? `\u20B9${formatCurrency(record.paid_amount)}` : 'N/A', MARGIN, y, labelWidth);
  if (record.payer_name) {
    y = drawLabelValue(doc, 'Payer:', field(record.payer_name), MARGIN, y, labelWidth);
  }
  if (record.payee_name) {
    y = drawLabelValue(doc, 'Payee:', field(record.payee_name), MARGIN, y, labelWidth);
  }
  y += 10;

  // Timestamps
  doc.setDrawColor(200, 200, 200);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 8;

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Record created: ${record.created_at ? format(new Date(record.created_at), 'dd MMM yyyy, HH:mm') : 'N/A'}`, MARGIN, y);
  y += 5;
  doc.text(`Proof generated: ${generatedAt}`, MARGIN, y);
  doc.setTextColor(0, 0, 0);
}

/** Page 2/3: Full-page image with caption. Fetches blob from Drive. */
async function addImagePage(doc, fileId, caption) {
  let y = MARGIN;

  // Caption
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(caption, PAGE_WIDTH / 2, y + 5, { align: 'center' });
  y += 15;

  if (!fileId) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(12);
    doc.setTextColor(150, 150, 150);
    doc.text('Image not available', PAGE_WIDTH / 2, PAGE_HEIGHT / 2, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    return;
  }

  try {
    const blob = await getImageBlob(fileId);
    const dataUrl = await blobToDataUrl(blob);
    const dims = await getImageDimensions(dataUrl);

    if (!dims) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(12);
      doc.setTextColor(150, 150, 150);
      doc.text('Image could not be loaded', PAGE_WIDTH / 2, PAGE_HEIGHT / 2, { align: 'center' });
      doc.setTextColor(0, 0, 0);
      return;
    }

    const maxW = CONTENT_WIDTH;
    const maxH = PAGE_HEIGHT - y - MARGIN - 10; // leave space for footer
    const scale = Math.min(maxW / dims.width, maxH / dims.height, 1);
    const imgW = dims.width * scale;
    const imgH = dims.height * scale;
    const imgX = MARGIN + (CONTENT_WIDTH - imgW) / 2;

    const imgFormat = dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
    doc.addImage(dataUrl, imgFormat, imgX, y, imgW, imgH);
  } catch (err) {
    console.error(`Failed to load image for PDF (${caption}):`, err);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(12);
    doc.setTextColor(150, 150, 150);
    doc.text('Image could not be loaded', PAGE_WIDTH / 2, PAGE_HEIGHT / 2, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  }
}

/** Page 4: Data summary table with all extracted fields. */
function addSummaryPage(doc, record, generatedAt) {
  let y = MARGIN;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Data Summary', PAGE_WIDTH / 2, y + 5, { align: 'center' });
  y += 15;

  doc.setDrawColor(200, 200, 200);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 8;

  const rows = [
    ['Trader Name', field(record.trader_name)],
    ['Trader Address', field(record.trader_address)],
    ['Invoice Number', field(record.invoice_number)],
    ['Bill Date', formatDisplayDate(record.bill_date) || 'N/A'],
    ['Bill Amount', record.bill_amount ? `\u20B9${formatCurrency(record.bill_amount)}` : 'N/A'],
    ['Currency', field(record.currency)],
    ...(record.payment_mode === 'gpay'
      ? [
          ['UPI Transaction ID', field(record.upi_transaction_id)],
          ['Google Transaction ID', field(record.google_transaction_id)],
        ]
      : [['UTR Number', field(record.utr_number)]]),
    ['Payment Date', formatDisplayDate(record.payment_date) || 'N/A'],
    ['Payment Mode', PAYMENT_MODE_LABELS[record.payment_mode] || field(record.payment_mode)],
    ['Paid Amount', record.paid_amount ? `\u20B9${formatCurrency(record.paid_amount)}` : 'N/A'],
    ['Payer Name', field(record.payer_name)],
    ['Payee Name', field(record.payee_name)],
    ['Record ID', field(record.record_id)],
    ['Created At', record.created_at ? format(new Date(record.created_at), 'dd MMM yyyy, HH:mm') : 'N/A'],
    ['Status', field(record.status)],
  ];

  const colWidth = 50;
  for (const [label, value] of rows) {
    // Alternate row background
    if (rows.indexOf([label, value]) % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(MARGIN, y - 4, CONTENT_WIDTH, 8, 'F');
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(label, MARGIN + 2, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(String(value), MARGIN + colWidth, y);
    y += 8;
  }

  y += 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 8;

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`Proof generated: ${generatedAt}`, MARGIN, y);
  doc.setTextColor(0, 0, 0);
}

/** Bulk cover page listing all selected records. */
function addBulkCoverPage(doc, records, generatedAt) {
  let y = MARGIN + 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text(BUSINESS_NAME, PAGE_WIDTH / 2, y, { align: 'center' });
  y += 12;

  doc.setFontSize(18);
  doc.setTextColor(80, 80, 80);
  doc.text('Bulk Payment Proof', PAGE_WIDTH / 2, y, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y += 10;

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 10;

  doc.setFontSize(11);
  doc.text(`${records.length} record${records.length !== 1 ? 's' : ''} included`, MARGIN, y);
  y += 10;

  // Table header
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(241, 245, 249);
  doc.rect(MARGIN, y - 4, CONTENT_WIDTH, 8, 'F');
  doc.text('#', MARGIN + 2, y);
  doc.text('Trader', MARGIN + 12, y);
  doc.text('Invoice', MARGIN + 80, y);
  doc.text('Date', MARGIN + 120, y);
  doc.text('Amount', MARGIN + 150, y);
  y += 8;

  // Table rows
  doc.setFont('helvetica', 'normal');
  records.forEach((record, i) => {
    if (y > PAGE_HEIGHT - MARGIN - 20) {
      doc.addPage();
      y = MARGIN + 10;
    }
    doc.text(String(i + 1), MARGIN + 2, y);
    doc.text((record.trader_name || 'N/A').substring(0, 30), MARGIN + 12, y);
    doc.text((record.invoice_number || 'N/A').substring(0, 18), MARGIN + 80, y);
    doc.text(formatDisplayDate(record.bill_date) || 'N/A', MARGIN + 120, y);
    doc.text(record.bill_amount ? `\u20B9${formatCurrency(record.bill_amount)}` : 'N/A', MARGIN + 150, y);
    y += 7;
  });

  y += 10;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`Proof generated: ${generatedAt}`, MARGIN, y);
  doc.setTextColor(0, 0, 0);
}

/**
 * Check for duplicate records by composite key among active records.
 * @param {string} compositeKey - The computed composite key to check
 * @param {string|null} [excludeRecordId=null] - Record ID to exclude (used during edits)
 * @returns {Promise<{ isDuplicate: boolean, existingRecord?: Object }>}
 */
export async function checkDuplicate(compositeKey, excludeRecordId = null) {
  const records = await getAllRecords();
  const existing = records.find(
    (r) =>
      r.composite_key === compositeKey &&
      r.status === 'active' &&
      r.record_id !== excludeRecordId
  );
  return existing
    ? { isDuplicate: true, existingRecord: existing }
    : { isDuplicate: false };
}

/**
 * Save a new record atomically.
 * Order: upload bill image → upload payment image → append Sheet row.
 * Rolls back on failure per error handling contracts:
 *   1. Bill upload fails → abort, no cleanup
 *   2. Payment upload fails → delete bill from Drive
 *   3. Sheet append fails → delete both images from Drive
 *   4. Rollback cleanup fails → log error, notify user about manual cleanup
 *
 * @param {Object} params
 * @param {Blob} params.billBlob - Processed bill image
 * @param {Blob} params.paymentBlob - Processed payment image
 * @param {Object} params.billFields - OCR-extracted bill fields
 * @param {Object} params.paymentFields - OCR-extracted payment fields
 * @param {boolean} [params.forceSave=false] - Skip duplicate check
 * @returns {Promise<Object>} The complete record as saved to Sheet
 * @throws {Error} With user-friendly messages; code='DUPLICATE_DETECTED' for duplicates
 */
export async function saveRecord({ billBlob, paymentBlob, billFields, paymentFields, forceSave = false }) {
  const recordId = uuidv4();
  const now = new Date().toISOString();

  const compositeKey = computeCompositeKey(
    billFields.trader_name,
    billFields.invoice_number,
    billFields.bill_date
  );

  // Duplicate check
  if (!forceSave) {
    const { isDuplicate, existingRecord } = await checkDuplicate(compositeKey);
    if (isDuplicate) {
      const error = new Error('Duplicate record detected');
      error.code = 'DUPLICATE_DETECTED';
      error.existingRecord = existingRecord;
      throw error;
    }
  }

  let billFileId = null;
  let billWebViewLink = null;
  let paymentFileId = null;
  let paymentWebViewLink = null;

  // Step 1: Upload bill image
  try {
    const billResult = await uploadImage(billBlob, 'bill', recordId);
    billFileId = billResult.fileId;
    billWebViewLink = billResult.webViewLink;
  } catch {
    throw new Error('Failed to upload bill image. Please try again.');
  }

  // Step 2: Upload payment image
  try {
    const paymentResult = await uploadImage(paymentBlob, 'payment', recordId);
    paymentFileId = paymentResult.fileId;
    paymentWebViewLink = paymentResult.webViewLink;
  } catch {
    // Rollback: delete bill image
    try {
      await deleteImage(billFileId);
    } catch (rollbackErr) {
      console.error('Rollback failed: could not delete bill image', rollbackErr);
      throw new Error('Failed to upload payment image. Some files may need manual cleanup in Drive.');
    }
    throw new Error('Failed to upload payment image. Please try again.');
  }

  // Step 3: Build record and append to Sheet
  const billConfidence = billFields.confidence || 0;
  const paymentConfidence = paymentFields.confidence || 0;
  const needsReview = billConfidence < 0.7 || paymentConfidence < 0.7;

  const record = {
    record_id: recordId,
    created_at: now,
    updated_at: now,
    status: 'active',
    archived_at: '',
    archived_reason: '',
    trader_name: billFields.trader_name || '',
    trader_address: billFields.trader_address || '',
    invoice_number: billFields.invoice_number || '',
    bill_date: billFields.bill_date || '',
    bill_amount: billFields.bill_amount || '',
    currency: billFields.currency || 'INR',
    composite_key: compositeKey,
    utr_number: paymentFields.utr_number || '',
    payment_date: paymentFields.payment_date || '',
    payment_mode: paymentFields.payment_mode || 'other',
    paid_amount: paymentFields.paid_amount || '',
    payer_name: paymentFields.payer_name || '',
    payee_name: paymentFields.payee_name || '',
    upi_transaction_id: paymentFields.upi_transaction_id || '',
    google_transaction_id: paymentFields.google_transaction_id || '',
    bill_image_file_id: billFileId,
    bill_image_url: billWebViewLink,
    payment_image_file_id: paymentFileId,
    payment_image_url: paymentWebViewLink,
    bill_ocr_confidence: String(billConfidence),
    payment_ocr_confidence: String(paymentConfidence),
    needs_review: needsReview ? 'true' : 'false',
    edit_count: '0',
    last_edited_field: '',
    last_edited_at: '',
    notes: '',
    tags: '',
  };

  try {
    await appendRecord(record);
  } catch {
    // Rollback: delete both images
    try {
      await Promise.all([deleteImage(billFileId), deleteImage(paymentFileId)]);
    } catch (rollbackErr) {
      console.error('Rollback failed: could not delete images', rollbackErr);
      throw new Error('Failed to save record. Some files may need manual cleanup in Drive.');
    }
    throw new Error('Failed to save record. Please try again.');
  }

  return record;
}

/* ── Record Editing ──────────────────────────────────────────────────── */

/** Fields that must never change after creation. */
const IMMUTABLE_FIELDS = [
  'record_id',
  'created_at',
  'bill_image_file_id',
  'bill_image_url',
  'payment_image_file_id',
  'payment_image_url',
  'bill_ocr_confidence',
  'payment_ocr_confidence',
];

/** Composite key fields that trigger recomputation and duplicate re-check. */
const COMPOSITE_KEY_FIELDS = ['trader_name', 'invoice_number', 'bill_date'];

/**
 * Edit an existing record's mutable fields.
 * Validates immutability constraints, recomputes composite key when needed,
 * re-runs duplicate detection, and updates the audit trail.
 *
 * @param {string} recordId - The record_id to edit
 * @param {Object} changes - Object with field names and new values (mutable fields only)
 * @returns {Promise<Object>} The updated record
 * @throws {Error} If record not found, immutable fields modified, or duplicate detected
 */
export async function editRecord(recordId, changes) {
  // Reject immutable field changes
  for (const field of IMMUTABLE_FIELDS) {
    if (field in changes) {
      throw new Error(`Cannot modify immutable field: ${field}`);
    }
  }

  // Fetch current record
  const records = await getAllRecords();
  const current = records.find((r) => r.record_id === recordId);
  if (!current) throw new Error('Record not found');

  // Determine which fields actually changed
  const changedFields = [];
  for (const [key, value] of Object.entries(changes)) {
    if (String(value) !== String(current[key] || '')) {
      changedFields.push(key);
    }
  }

  if (changedFields.length === 0) {
    return current;
  }

  // Merge changes into current record
  const merged = { ...current };
  for (const [key, value] of Object.entries(changes)) {
    if (changedFields.includes(key)) {
      merged[key] = value;
    }
  }

  // Recompute composite key if any key field changed
  const keyFieldChanged = COMPOSITE_KEY_FIELDS.some((f) => changedFields.includes(f));
  if (keyFieldChanged) {
    merged.composite_key = computeCompositeKey(
      merged.trader_name,
      merged.invoice_number,
      merged.bill_date
    );

    // Duplicate check excluding self
    const { isDuplicate, existingRecord } = await checkDuplicate(
      merged.composite_key,
      recordId
    );
    if (isDuplicate) {
      const error = new Error('Duplicate record detected');
      error.code = 'DUPLICATE_DETECTED';
      error.existingRecord = existingRecord;
      throw error;
    }
  }

  // Update audit trail
  const now = new Date().toISOString();
  merged.updated_at = now;
  merged.last_edited_at = now;
  merged.edit_count = String(parseInt(merged.edit_count || '0', 10) + 1);
  merged.last_edited_field = changedFields.join(', ');

  // Recalculate needs_review based on confidence thresholds
  const billConf = parseFloat(merged.bill_ocr_confidence) || 0;
  const payConf = parseFloat(merged.payment_ocr_confidence) || 0;
  merged.needs_review = billConf < 0.7 || payConf < 0.7 ? 'true' : 'false';

  // Remove internal _rowIndex before writing to Sheet
  const { _rowIndex, ...recordToSave } = merged;
  await updateRecord(recordId, recordToSave);

  return merged;
}

/* ── Proof Packet Generation ─────────────────────────────────────────── */

/**
 * Generate a plain-text proof summary for clipboard/chat sharing.
 * @param {Object} record - Full record object from Sheets
 * @returns {string} Multi-line plain-text summary
 */
export function generatePlainTextSummary(record) {
  const lines = [
    `--- ${PDF_TITLE} ---`,
    `Trader: ${field(record.trader_name)}`,
    `Invoice: ${field(record.invoice_number)}`,
    `Bill Date: ${formatDisplayDate(record.bill_date) || 'N/A'}`,
    `Amount: ${record.bill_amount ? `\u20B9${formatCurrency(record.bill_amount)}` : 'N/A'}`,
    `Payment Mode: ${PAYMENT_MODE_LABELS[record.payment_mode] || field(record.payment_mode)}`,
    ...(record.payment_mode === 'gpay'
      ? [
          `UPI Transaction ID: ${field(record.upi_transaction_id)}`,
          `Google Transaction ID: ${field(record.google_transaction_id)}`,
        ]
      : [`UTR Number: ${field(record.utr_number)}`]),
    `Payment Date: ${formatDisplayDate(record.payment_date) || 'N/A'}`,
    `--- ${BUSINESS_NAME} ---`,
  ];
  return lines.join('\n');
}

/**
 * Generate a single-record 4-page Proof Packet PDF.
 * Page 1: Branded cover with key fields.
 * Page 2: Bill image fetched from Drive.
 * Page 3: Payment receipt image fetched from Drive.
 * Page 4: Data summary table with generation timestamp.
 * @param {Object} record - Full record object
 * @returns {Promise<Blob>} PDF as a Blob
 */
export async function generateProofPacketPDF(record) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const generatedAt = format(new Date(), 'dd MMM yyyy, HH:mm');

  // Page 1: Cover
  addCoverPage(doc, record, generatedAt);

  // Page 2: Bill image
  doc.addPage();
  await addImagePage(doc, record.bill_image_file_id, 'Bill Image');

  // Page 3: Payment image
  doc.addPage();
  await addImagePage(doc, record.payment_image_file_id, 'Payment Receipt Image');

  // Page 4: Data summary
  doc.addPage();
  addSummaryPage(doc, record, generatedAt);

  // Add footers to all pages
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addPageFooter(doc, i, totalPages);
  }

  return doc.output('blob');
}

/**
 * Generate a bulk Proof Packet PDF for multiple records.
 * Cover page lists all selected records, then each record's 4 pages follow.
 * @param {Object[]} records - Array of full record objects
 * @returns {Promise<Blob>} PDF as a Blob
 */
export async function generateBulkProofPacketPDF(records) {
  if (!records || records.length === 0) {
    throw new Error('No records selected for export.');
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const generatedAt = format(new Date(), 'dd MMM yyyy, HH:mm');

  // Bulk cover page
  addBulkCoverPage(doc, records, generatedAt);

  // Each record's 4 pages
  for (const record of records) {
    doc.addPage();
    addCoverPage(doc, record, generatedAt);

    doc.addPage();
    await addImagePage(doc, record.bill_image_file_id, 'Bill Image');

    doc.addPage();
    await addImagePage(doc, record.payment_image_file_id, 'Payment Receipt Image');

    doc.addPage();
    addSummaryPage(doc, record, generatedAt);
  }

  // Add footers to all pages
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addPageFooter(doc, i, totalPages);
  }

  return doc.output('blob');
}

/* ── Full Backup ─────────────────────────────────────────────────────── */

/**
 * Build a branded backup ZIP filename with the current date.
 * @returns {string} e.g. "amit_general_store_backup_2026-05-21.zip"
 */
export function buildBackupFilename() {
  return `${BACKUP_FILENAME_PREFIX}_${format(new Date(), 'yyyy-MM-dd')}.zip`;
}

/**
 * Generate a full backup ZIP containing:
 * - CSV of all records (including archived)
 * - /bills/ folder with all bill images from Drive
 * - /payments/ folder with all payment images from Drive
 * - README.txt with reconstruction instructions
 *
 * @param {function} [onProgress] - Progress callback: ({ current, total, phase }) => void
 * @returns {Promise<Blob>} ZIP file as a Blob
 */
export async function downloadFullBackup(onProgress) {
  const records = await getAllRecords();

  const csvString = generateCsvString(records);
  const csvFilename = buildCsvFilename();

  const zip = new JSZip();
  zip.file(csvFilename, csvString);

  // Count total images to fetch
  const billImages = records.filter((r) => r.bill_image_file_id);
  const paymentImages = records.filter((r) => r.payment_image_file_id);
  const totalImages = billImages.length + paymentImages.length;
  let current = 0;

  if (onProgress) onProgress({ current: 0, total: totalImages, phase: 'images' });

  // Fetch and add bill images
  const billsFolder = zip.folder('bills');
  for (const record of billImages) {
    try {
      const blob = await getImageBlob(record.bill_image_file_id);
      billsFolder.file(`${record.record_id}_bill.jpg`, blob);
    } catch (err) {
      console.error(`Failed to fetch bill image for record ${record.record_id}:`, err);
    }
    current++;
    if (onProgress) onProgress({ current, total: totalImages, phase: 'images' });
  }

  // Fetch and add payment images
  const paymentsFolder = zip.folder('payments');
  for (const record of paymentImages) {
    try {
      const blob = await getImageBlob(record.payment_image_file_id);
      paymentsFolder.file(`${record.record_id}_payment.jpg`, blob);
    } catch (err) {
      console.error(`Failed to fetch payment image for record ${record.record_id}:`, err);
    }
    current++;
    if (onProgress) onProgress({ current, total: totalImages, phase: 'images' });
  }

  // Add README
  const readme = [
    `${BUSINESS_NAME} \u2014 Full Backup`,
    `Generated: ${format(new Date(), 'dd MMM yyyy, HH:mm')}`,
    '',
    'Contents:',
    `- ${csvFilename} \u2014 All receipt records (including archived)`,
    '- bills/ \u2014 Bill images from Google Drive',
    '- payments/ \u2014 Payment receipt images from Google Drive',
    '',
    'To restore: Import the CSV into Google Sheets and upload images to Google Drive.',
  ].join('\n');
  zip.file('README.txt', readme);

  return zip.generateAsync({ type: 'blob' });
}
