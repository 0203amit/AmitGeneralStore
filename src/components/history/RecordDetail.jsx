/**
 * RecordDetail view at /history/:recordId.
 * Displays all bill fields, payment fields, audit trail, and both original
 * images side-by-side (stacked on mobile) fetched from Drive, with
 * "Download Images" option. Supports edit mode for mutable fields.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  AlertTriangle,
  CreditCard,
  FileText,
  Clock,
  Hash,
  FileDown,
  Share2,
  Mail,
  Copy,
  Pencil,
  Save,
  X,
  Archive,
  RotateCcw,
} from 'lucide-react';
import { saveAs } from 'file-saver';
import { getAllRecords, archiveRecord, restoreRecord } from '../../services/sheetsService';
import { getImageBlob } from '../../services/driveService';
import { generateProofPacketPDF, generatePlainTextSummary, editRecord } from '../../services/recordService';
import { formatDisplayDate, formatTimestamp, formatCurrency } from '../../utils/dateHelpers';
import { buildPageTitle } from '../../config/branding';
import { useToast } from '../shared/Toast';
import LoadingSpinner from '../shared/LoadingSpinner';

const PAYMENT_MODE_LABELS = {
  gpay: 'GPay',
  phonepe: 'PhonePe',
  paytm: 'Paytm',
  net_banking: 'Net Banking',
  card: 'Card',
  other: 'Other',
};

const PAYMENT_MODE_COLORS = {
  gpay: 'bg-blue-100 text-blue-700',
  phonepe: 'bg-purple-100 text-purple-700',
  paytm: 'bg-cyan-100 text-cyan-700',
  net_banking: 'bg-emerald-100 text-emerald-700',
  card: 'bg-orange-100 text-orange-700',
  other: 'bg-slate-100 text-slate-600',
};

/** Editable bill fields in edit mode. */
const BILL_EDIT_FIELDS = [
  { key: 'trader_name', label: 'Trader Name', type: 'text' },
  { key: 'trader_address', label: 'Trader Address', type: 'text' },
  { key: 'invoice_number', label: 'Invoice Number', type: 'text' },
  { key: 'bill_date', label: 'Bill Date', type: 'date' },
  { key: 'bill_amount', label: 'Bill Amount', type: 'number' },
  { key: 'currency', label: 'Currency', type: 'text' },
];

/** Editable payment fields in edit mode. */
const PAYMENT_EDIT_FIELDS = [
  { key: 'utr_number', label: 'UTR Number', type: 'text' },
  { key: 'payment_date', label: 'Payment Date', type: 'date' },
  { key: 'payment_mode', label: 'Payment Mode', type: 'select' },
  { key: 'paid_amount', label: 'Amount Paid', type: 'number' },
  { key: 'payer_name', label: 'Payer', type: 'text' },
  { key: 'payee_name', label: 'Payee', type: 'text' },
];

export default function RecordDetail() {
  const { recordId } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [billImageUrl, setBillImageUrl] = useState(null);
  const [paymentImageUrl, setPaymentImageUrl] = useState(null);
  const [imagesLoading, setImagesLoading] = useState(true);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [generatedPdfBlob, setGeneratedPdfBlob] = useState(null);

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editFields, setEditFields] = useState({});
  const [saving, setSaving] = useState(false);
  const [duplicateRecord, setDuplicateRecord] = useState(null);

  // Archive state
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiving, setArchiving] = useState(false);

  document.title = buildPageTitle('detail');

  // Fetch record
  useEffect(() => {
    async function fetchRecord() {
      setLoading(true);
      setError(null);
      try {
        const records = await getAllRecords();
        const found = records.find((r) => r.record_id === recordId);
        if (!found) {
          setError('Record not found');
        } else {
          setRecord(found);
        }
      } catch (err) {
        setError(err.message || 'Failed to load record');
      } finally {
        setLoading(false);
      }
    }
    fetchRecord();
  }, [recordId]);

  // Fetch images from Drive
  useEffect(() => {
    if (!record) return;

    async function fetchImages() {
      setImagesLoading(true);
      try {
        const [billBlob, paymentBlob] = await Promise.all([
          record.bill_image_file_id ? getImageBlob(record.bill_image_file_id) : null,
          record.payment_image_file_id ? getImageBlob(record.payment_image_file_id) : null,
        ]);
        if (billBlob) setBillImageUrl(URL.createObjectURL(billBlob));
        if (paymentBlob) setPaymentImageUrl(URL.createObjectURL(paymentBlob));
      } catch {
        // Images may fail to load but record data is still useful
      } finally {
        setImagesLoading(false);
      }
    }
    fetchImages();

    return () => {
      if (billImageUrl) URL.revokeObjectURL(billImageUrl);
      if (paymentImageUrl) URL.revokeObjectURL(paymentImageUrl);
    };
  }, [record]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleDownloadImage(blobUrl, filename) {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.click();
  }

  async function handleGenerateProofPacket() {
    setPdfGenerating(true);
    try {
      const blob = await generateProofPacketPDF(record);
      setGeneratedPdfBlob(blob);
      const traderSlug = (record.trader_name || 'unknown').replace(/\s+/g, '_');
      const filename = `proof_${traderSlug}_${record.invoice_number || record.record_id}.pdf`;
      saveAs(blob, filename);
      addToast({ type: 'success', message: 'Proof packet downloaded' });
    } catch (err) {
      console.error('Proof packet generation failed:', err);
      addToast({ type: 'error', message: 'Failed to generate proof packet' });
    } finally {
      setPdfGenerating(false);
    }
  }

  async function handleShareWhatsApp() {
    let blob = generatedPdfBlob;
    if (!blob) {
      setPdfGenerating(true);
      try {
        blob = await generateProofPacketPDF(record);
        setGeneratedPdfBlob(blob);
      } catch {
        addToast({ type: 'error', message: 'Failed to generate proof packet' });
        setPdfGenerating(false);
        return;
      }
      setPdfGenerating(false);
    }

    const file = new File([blob], 'proof_packet.pdf', { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: `Payment Proof - ${record.trader_name || 'Unknown'}`,
          files: [file],
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          addToast({ type: 'error', message: 'Sharing failed' });
        }
      }
    } else {
      const text = encodeURIComponent(generatePlainTextSummary(record));
      window.open(`https://wa.me/?text=${text}`, '_blank');
    }
  }

  function handleShareEmail() {
    const subject = encodeURIComponent(
      `Payment Proof: ${record.trader_name || ''} - Invoice ${record.invoice_number || ''}`
    );
    const body = encodeURIComponent(generatePlainTextSummary(record));
    window.open(`mailto:?subject=${subject}&body=${body}`);
  }

  async function handleCopyProofSummary() {
    const text = generatePlainTextSummary(record);
    try {
      await navigator.clipboard.writeText(text);
      addToast({ type: 'success', message: 'Proof summary copied to clipboard' });
    } catch {
      addToast({ type: 'error', message: 'Failed to copy to clipboard' });
    }
  }

  // ── Edit mode handlers ──────────────────────────────────────────────

  function handleStartEdit() {
    setEditFields({
      trader_name: record.trader_name || '',
      trader_address: record.trader_address || '',
      invoice_number: record.invoice_number || '',
      bill_date: record.bill_date || '',
      bill_amount: record.bill_amount || '',
      currency: record.currency || 'INR',
      utr_number: record.utr_number || '',
      payment_date: record.payment_date || '',
      payment_mode: record.payment_mode || 'other',
      paid_amount: record.paid_amount || '',
      payer_name: record.payer_name || '',
      payee_name: record.payee_name || '',
      notes: record.notes || '',
      tags: record.tags || '',
    });
    setEditMode(true);
  }

  function handleCancelEdit() {
    setEditMode(false);
    setEditFields({});
    setDuplicateRecord(null);
  }

  function handleEditField(key, value) {
    setEditFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSaveEdit() {
    // Compute only the fields that actually changed
    const changes = {};
    for (const [key, value] of Object.entries(editFields)) {
      if (String(value) !== String(record[key] || '')) {
        changes[key] = value;
      }
    }

    if (Object.keys(changes).length === 0) {
      addToast({ type: 'info', message: 'No changes to save' });
      setEditMode(false);
      return;
    }

    setSaving(true);
    try {
      const updated = await editRecord(record.record_id, changes);
      setRecord(updated);
      setEditMode(false);
      setEditFields({});
      setGeneratedPdfBlob(null); // Invalidate cached PDF
      addToast({ type: 'success', message: 'Record updated successfully' });
    } catch (err) {
      if (err.code === 'DUPLICATE_DETECTED') {
        setDuplicateRecord(err.existingRecord);
      } else {
        addToast({ type: 'error', message: err.message || 'Failed to update record' });
      }
    } finally {
      setSaving(false);
    }
  }

  // ── Archive/Restore handlers ───────────────────────────────────────

  async function handleArchive() {
    setArchiving(true);
    try {
      const updated = await archiveRecord(record.record_id, archiveReason.trim());
      setRecord(updated);
      setShowArchiveDialog(false);
      setArchiveReason('');
      setGeneratedPdfBlob(null);
      addToast({ type: 'success', message: 'Record archived successfully' });
    } catch (err) {
      addToast({ type: 'error', message: err.message || 'Failed to archive record' });
    } finally {
      setArchiving(false);
    }
  }

  async function handleRestore() {
    setArchiving(true);
    try {
      const updated = await restoreRecord(record.record_id);
      setRecord(updated);
      setGeneratedPdfBlob(null);
      addToast({ type: 'success', message: 'Record restored successfully' });
    } catch (err) {
      addToast({ type: 'error', message: err.message || 'Failed to restore record' });
    } finally {
      setArchiving(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-8">
        <button
          onClick={() => navigate('/history')}
          className="mb-4 flex items-center gap-2 text-sm text-slate-600 hover:text-brand-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to History
        </button>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">{error}</p>
          <Link
            to="/history"
            className="mt-3 inline-block text-sm font-medium text-brand-primary hover:underline"
          >
            Return to History
          </Link>
        </div>
      </div>
    );
  }

  if (!record) return null;

  const needsReview = record.needs_review === 'true';

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigate('/history')}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-brand-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to History
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {needsReview && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              Needs review
            </span>
          )}
          {!editMode && record.status === 'active' && (
            <>
              <button
                onClick={handleStartEdit}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                onClick={() => setShowArchiveDialog(true)}
                disabled={archiving}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <Archive className="h-3.5 w-3.5" />
                Archive
              </button>
            </>
          )}
          {!editMode && record.status === 'archived' && (
            <button
              onClick={handleRestore}
              disabled={archiving}
              className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 transition hover:bg-green-100 disabled:opacity-50"
            >
              {archiving ? (
                <>
                  <LoadingSpinner size="sm" />
                  Restoring…
                </>
              ) : (
                <>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restore
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          {editMode ? (editFields.trader_name || 'Unknown Trader') : (record.trader_name || 'Unknown Trader')}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Invoice {(editMode ? editFields.invoice_number : record.invoice_number) || '—'} · {formatDisplayDate(editMode ? editFields.bill_date : record.bill_date)}
        </p>
      </div>

      {/* Edit mode action bar */}
      {editMode && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <span className="text-sm font-medium text-blue-700">Editing record</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              onClick={handleCancelEdit}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md bg-brand-primary px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-primary/90 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <LoadingSpinner size="sm" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bill fields */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <FileText className="h-4 w-4" />
            Bill Details
          </h2>
          <dl className="space-y-3">
            {editMode ? (
              <>
                {BILL_EDIT_FIELDS.map((f) => (
                  <EditRow
                    key={f.key}
                    label={f.label}
                    type={f.type}
                    value={editFields[f.key]}
                    onChange={(v) => handleEditField(f.key, v)}
                  />
                ))}
                {record.bill_ocr_confidence && (
                  <DetailRow
                    label="OCR Confidence"
                    value={`${(parseFloat(record.bill_ocr_confidence) * 100).toFixed(0)}%`}
                    warn={parseFloat(record.bill_ocr_confidence) < 0.7}
                    readOnly
                  />
                )}
              </>
            ) : (
              <>
                <DetailRow label="Trader Name" value={record.trader_name} />
                <DetailRow label="Trader Address" value={record.trader_address} />
                <DetailRow label="Invoice Number" value={record.invoice_number} />
                <DetailRow label="Bill Date" value={formatDisplayDate(record.bill_date)} />
                <DetailRow
                  label="Bill Amount"
                  value={record.bill_amount ? `₹${formatCurrency(record.bill_amount)}` : ''}
                />
                <DetailRow label="Currency" value={record.currency || 'INR'} />
                {record.bill_ocr_confidence && (
                  <DetailRow
                    label="OCR Confidence"
                    value={`${(parseFloat(record.bill_ocr_confidence) * 100).toFixed(0)}%`}
                    warn={parseFloat(record.bill_ocr_confidence) < 0.7}
                  />
                )}
              </>
            )}
          </dl>
        </div>

        {/* Payment fields */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <CreditCard className="h-4 w-4" />
            Payment Details
          </h2>
          <dl className="space-y-3">
            {editMode ? (
              <>
                {PAYMENT_EDIT_FIELDS.map((f) =>
                  f.type === 'select' ? (
                    <EditRow
                      key={f.key}
                      label={f.label}
                      type="select"
                      value={editFields[f.key]}
                      onChange={(v) => handleEditField(f.key, v)}
                      options={PAYMENT_MODE_LABELS}
                    />
                  ) : (
                    <EditRow
                      key={f.key}
                      label={f.label}
                      type={f.type}
                      value={editFields[f.key]}
                      onChange={(v) => handleEditField(f.key, v)}
                    />
                  )
                )}
                {record.payment_ocr_confidence && (
                  <DetailRow
                    label="OCR Confidence"
                    value={`${(parseFloat(record.payment_ocr_confidence) * 100).toFixed(0)}%`}
                    warn={parseFloat(record.payment_ocr_confidence) < 0.7}
                    readOnly
                  />
                )}
              </>
            ) : (
              <>
                <DetailRow label="UTR Number" value={record.utr_number} />
                <DetailRow label="Payment Date" value={formatDisplayDate(record.payment_date)} />
                <DetailRow
                  label="Payment Mode"
                  value={
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        PAYMENT_MODE_COLORS[record.payment_mode] || PAYMENT_MODE_COLORS.other
                      }`}
                    >
                      {PAYMENT_MODE_LABELS[record.payment_mode] || record.payment_mode}
                    </span>
                  }
                />
                <DetailRow
                  label="Amount Paid"
                  value={record.paid_amount ? `₹${formatCurrency(record.paid_amount)}` : ''}
                />
                <DetailRow label="Payer" value={record.payer_name} />
                <DetailRow label="Payee" value={record.payee_name} />
                {record.payment_ocr_confidence && (
                  <DetailRow
                    label="OCR Confidence"
                    value={`${(parseFloat(record.payment_ocr_confidence) * 100).toFixed(0)}%`}
                    warn={parseFloat(record.payment_ocr_confidence) < 0.7}
                  />
                )}
              </>
            )}
          </dl>
        </div>

        {/* Images (always read-only — immutable) */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6 lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <FileText className="h-4 w-4" />
            Original Images
          </h2>
          {imagesLoading ? (
            <LoadingSpinner size="md" className="py-8" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Bill image */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-500">Bill Image</p>
                  {billImageUrl && (
                    <button
                      onClick={() =>
                        handleDownloadImage(
                          billImageUrl,
                          `${record.record_id}_bill.jpg`
                        )
                      }
                      className="flex items-center gap-1 text-xs text-brand-primary hover:underline"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </button>
                  )}
                </div>
                {billImageUrl ? (
                  <img
                    src={billImageUrl}
                    alt="Bill"
                    className="w-full rounded-lg border border-slate-200 object-contain"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
                    <p className="text-xs text-slate-400">Image not available</p>
                  </div>
                )}
              </div>

              {/* Payment image */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-500">Payment Receipt</p>
                  {paymentImageUrl && (
                    <button
                      onClick={() =>
                        handleDownloadImage(
                          paymentImageUrl,
                          `${record.record_id}_payment.jpg`
                        )
                      }
                      className="flex items-center gap-1 text-xs text-brand-primary hover:underline"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </button>
                  )}
                </div>
                {paymentImageUrl ? (
                  <img
                    src={paymentImageUrl}
                    alt="Payment receipt"
                    className="w-full rounded-lg border border-slate-200 object-contain"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
                    <p className="text-xs text-slate-400">Image not available</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Notes & Tags */}
        {(editMode || record.notes || record.tags) && (
          <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6 lg:col-span-2">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Hash className="h-4 w-4" />
              Notes & Tags
            </h2>
            <dl className="space-y-3">
              {editMode ? (
                <>
                  <EditRow
                    label="Notes"
                    type="textarea"
                    value={editFields.notes}
                    onChange={(v) => handleEditField('notes', v)}
                  />
                  <EditRow
                    label="Tags"
                    type="text"
                    value={editFields.tags}
                    onChange={(v) => handleEditField('tags', v)}
                    placeholder="Comma-separated tags"
                  />
                </>
              ) : (
                <>
                  {record.notes && <DetailRow label="Notes" value={record.notes} />}
                  {record.tags && (
                    <DetailRow
                      label="Tags"
                      value={
                        <div className="flex flex-wrap gap-1">
                          {record.tags.split(',').map((tag) => (
                            <span
                              key={tag.trim()}
                              className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                            >
                              {tag.trim()}
                            </span>
                          ))}
                        </div>
                      }
                    />
                  )}
                </>
              )}
            </dl>
          </div>
        )}

        {/* Proof Packet (hidden in edit mode) */}
        {!editMode && (
          <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6 lg:col-span-2">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <FileDown className="h-4 w-4" />
              Proof Packet
            </h2>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleGenerateProofPacket}
                disabled={pdfGenerating}
                className="flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-primary/90 disabled:opacity-50"
              >
                {pdfGenerating ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Generating…
                  </>
                ) : (
                  <>
                    <FileDown className="h-4 w-4" />
                    Download Proof PDF
                  </>
                )}
              </button>
              <button
                onClick={handleShareWhatsApp}
                disabled={pdfGenerating}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <Share2 className="h-4 w-4" />
                Share via WhatsApp
              </button>
              <button
                onClick={handleShareEmail}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Mail className="h-4 w-4" />
                Share via Email
              </button>
              <button
                onClick={handleCopyProofSummary}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Copy className="h-4 w-4" />
                Copy Summary
              </button>
            </div>
          </div>
        )}

        {/* Audit trail */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6 lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Clock className="h-4 w-4" />
            Audit Trail
          </h2>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <DetailRow
              label="Record ID"
              value={
                <span className="font-mono text-xs">{record.record_id}</span>
              }
            />
            <DetailRow label="Created" value={formatTimestamp(record.created_at)} />
            <DetailRow label="Last Updated" value={formatTimestamp(record.updated_at)} />
            <DetailRow label="Status" value={
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                record.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
              }`}>
                {record.status}
              </span>
            } />
            <DetailRow
              label="Edit Count"
              value={record.edit_count || '0'}
            />
            {record.last_edited_field && (
              <DetailRow label="Last Edited Field" value={record.last_edited_field} />
            )}
            {record.last_edited_at && (
              <DetailRow label="Last Edited At" value={formatTimestamp(record.last_edited_at)} />
            )}
            {record.archived_at && (
              <DetailRow label="Archived At" value={formatTimestamp(record.archived_at)} />
            )}
            {record.archived_reason && (
              <DetailRow label="Archive Reason" value={record.archived_reason} />
            )}
          </dl>
        </div>
      </div>

      {/* Duplicate detection modal */}
      {duplicateRecord && (
        <DuplicateEditModal
          existingRecord={duplicateRecord}
          onViewExisting={() => {
            window.open(`/history/${duplicateRecord.record_id}`, '_blank');
          }}
          onDismiss={() => setDuplicateRecord(null)}
        />
      )}

      {/* Archive confirmation dialog */}
      {showArchiveDialog && (
        <ArchiveConfirmDialog
          onConfirm={handleArchive}
          onCancel={() => {
            setShowArchiveDialog(false);
            setArchiveReason('');
          }}
          archiveReason={archiveReason}
          onReasonChange={setArchiveReason}
          archiving={archiving}
        />
      )}
    </div>
  );
}

/** Read-only detail row. */
function DetailRow({ label, value, warn = false, readOnly = false }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
      <dt className="text-xs font-medium text-slate-500 sm:w-32 sm:flex-shrink-0">{label}</dt>
      <dd className={`text-sm ${warn ? 'font-medium text-amber-600' : 'text-slate-900'} ${readOnly ? 'italic text-slate-400' : ''}`}>
        {value || <span className="text-slate-300">—</span>}
      </dd>
    </div>
  );
}

/** Editable field row for edit mode. */
function EditRow({ label, type, value, onChange, options, placeholder }) {
  const inputClass =
    'w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary';

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      <dt className="text-xs font-medium text-slate-500 sm:w-32 sm:flex-shrink-0">{label}</dt>
      <dd className="flex-1">
        {type === 'select' ? (
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          >
            {Object.entries(options).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        ) : type === 'textarea' ? (
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            placeholder={placeholder}
            className={inputClass + ' resize-y'}
          />
        ) : (
          <input
            type={type}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            step={type === 'number' ? 'any' : undefined}
            className={inputClass}
          />
        )}
      </dd>
    </div>
  );
}

/** Confirmation dialog for archiving a record. */
function ArchiveConfirmDialog({ onConfirm, onCancel, archiveReason, onReasonChange, archiving }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <Archive className="h-6 w-6 flex-shrink-0 text-slate-500" />
          <h2 className="text-lg font-semibold text-slate-900">Archive Record</h2>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Archive this record? It will be hidden from the main view but never deleted.
          You can restore it anytime from the Archive page.
        </p>
        <div className="mt-4">
          <label htmlFor="archive-reason" className="mb-1 block text-xs font-medium text-slate-500">
            Reason (optional)
          </label>
          <textarea
            id="archive-reason"
            value={archiveReason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Why are you archiving this record?"
            rows={2}
            className="w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={archiving}
            className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={archiving}
            className="flex items-center justify-center gap-2 rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {archiving ? (
              <>
                <LoadingSpinner size="sm" />
                Archiving…
              </>
            ) : (
              'Archive'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal shown when editing creates a composite key collision. */
function DuplicateEditModal({ existingRecord, onViewExisting, onDismiss }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 flex-shrink-0 text-amber-500" />
          <h2 className="text-lg font-semibold text-slate-900">Duplicate Detected</h2>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Another active record already has the same trader name, invoice number, and bill date.
          Please change the conflicting fields before saving.
        </p>
        <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          <p>
            <span className="font-medium">Trader:</span> {existingRecord.trader_name}
          </p>
          <p>
            <span className="font-medium">Invoice:</span> {existingRecord.invoice_number}
          </p>
          <p>
            <span className="font-medium">Date:</span> {existingRecord.bill_date}
          </p>
          <p>
            <span className="font-medium">Amount:</span> ₹{existingRecord.bill_amount}
          </p>
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            OK
          </button>
          <button
            type="button"
            onClick={onViewExisting}
            className="rounded-md border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
          >
            View Existing
          </button>
        </div>
      </div>
    </div>
  );
}
