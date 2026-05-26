/**
 * RecordDetail view at /history/:recordId.
 * Displays all bill fields, payment fields, audit trail, and both original
 * images side-by-side (stacked on mobile) fetched from Drive, with
 * "Download Images" option. Supports edit mode for mutable fields.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import DatePicker from 'react-datepicker';
import { parse, format } from 'date-fns';
import { formatDisplayDate, formatTimestamp, formatCurrency } from '../../utils/dateHelpers';
import { buildPageTitle } from '../../config/branding';
import { useToast } from '../shared/Toast';
import LoadingSpinner from '../shared/LoadingSpinner';

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

const PAYMENT_MODE_COLORS = {
  gpay: 'bg-blue-100 text-blue-700',
  phonepe: 'bg-purple-100 text-purple-700',
  paytm: 'bg-cyan-100 text-cyan-700',
  neft: 'bg-emerald-100 text-emerald-700',
  rtgs: 'bg-teal-100 text-teal-700',
  card: 'bg-orange-100 text-orange-700',
  other: 'bg-slate-100 text-slate-600',
  net_banking: 'bg-emerald-100 text-emerald-700',
};

export default function RecordDetail() {
  const { t } = useTranslation();
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

  document.title = buildPageTitle(t('navbar.history'));

  /** Editable bill fields in edit mode. */
  const BILL_EDIT_FIELDS = [
    { key: 'trader_name', label: t('detail.traderName'), type: 'text' },
    { key: 'trader_address', label: t('detail.traderAddress'), type: 'text' },
    { key: 'invoice_number', label: t('detail.invoiceNumber'), type: 'text' },
    { key: 'bill_date', label: t('detail.billDate'), type: 'date' },
    { key: 'bill_amount', label: t('detail.billAmount'), type: 'number' },
    { key: 'currency', label: t('detail.currency'), type: 'text' },
  ];

  /** Editable payment fields in edit mode (dynamic based on payment mode). */
  function getPaymentEditFields(paymentMode) {
    const fields = [];
    if (paymentMode === 'gpay') {
      fields.push({ key: 'upi_transaction_id', label: t('detail.upiTransactionId'), type: 'text' });
      fields.push({ key: 'google_transaction_id', label: t('detail.googleTransactionId'), type: 'text' });
    } else {
      fields.push({ key: 'utr_number', label: t('detail.utrNumber'), type: 'text' });
    }
    fields.push(
      { key: 'payment_date', label: t('detail.paymentDate'), type: 'date' },
      { key: 'payment_mode', label: t('extraction.paymentMode'), type: 'select' },
      { key: 'paid_amount', label: t('detail.amountPaid'), type: 'number' },
      { key: 'payer_name', label: t('detail.payer'), type: 'text' },
      { key: 'payee_name', label: t('detail.payee'), type: 'text' },
    );
    return fields;
  }

  // Fetch record
  useEffect(() => {
    async function fetchRecord() {
      setLoading(true);
      setError(null);
      try {
        const records = await getAllRecords();
        const found = records.find((r) => r.record_id === recordId);
        if (!found) {
          setError(t('detail.recordNotFound'));
        } else {
          setRecord(found);
        }
      } catch (err) {
        setError(err.message || t('detail.failedToLoad'));
      } finally {
        setLoading(false);
      }
    }
    fetchRecord();
  }, [recordId, t]);

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
      addToast({ type: 'success', message: t('detail.proofDownloaded') });
    } catch (err) {
      console.error('Proof packet generation failed:', err);
      addToast({ type: 'error', message: t('detail.proofFailed') });
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
        addToast({ type: 'error', message: t('detail.proofFailed') });
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
          addToast({ type: 'error', message: t('detail.sharingFailed') });
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
      addToast({ type: 'success', message: t('detail.summaryCopieds') });
    } catch {
      addToast({ type: 'error', message: t('detail.copyFailed') });
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
      upi_transaction_id: record.upi_transaction_id || '',
      google_transaction_id: record.google_transaction_id || '',
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
      addToast({ type: 'info', message: t('detail.noChangesToSave') });
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
      addToast({ type: 'success', message: t('detail.recordUpdated') });
    } catch (err) {
      if (err.code === 'DUPLICATE_DETECTED') {
        setDuplicateRecord(err.existingRecord);
      } else {
        addToast({ type: 'error', message: err.message || t('detail.updateFailed') });
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
      addToast({ type: 'success', message: t('detail.recordArchived') });
    } catch (err) {
      addToast({ type: 'error', message: err.message || t('detail.archiveFailed') });
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
      addToast({ type: 'success', message: t('detail.recordRestored') });
    } catch (err) {
      addToast({ type: 'error', message: err.message || t('detail.restoreFailed') });
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
          {t('detail.backToHistory')}
        </button>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">{error}</p>
          <Link
            to="/history"
            className="mt-3 inline-block text-sm font-medium text-brand-primary hover:underline"
          >
            {t('detail.returnToHistory')}
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
          {t('detail.backToHistory')}
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {needsReview && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              {t('extraction.needsReview')}
            </span>
          )}
          {!editMode && record.status === 'active' && (
            <>
              <button
                onClick={handleStartEdit}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                {t('common.edit')}
              </button>
              <button
                onClick={() => setShowArchiveDialog(true)}
                disabled={archiving}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <Archive className="h-3.5 w-3.5" />
                {t('common.archive')}
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
                  {t('common.restoring')}
                </>
              ) : (
                <>
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t('common.restore')}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          {editMode ? (editFields.trader_name || t('history.unknownTrader')) : (record.trader_name || t('history.unknownTrader'))}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {t('detail.invoiceSubtitle', {
            number: (editMode ? editFields.invoice_number : record.invoice_number) || '\u2014',
            date: formatDisplayDate(editMode ? editFields.bill_date : record.bill_date),
          })}
        </p>
      </div>

      {/* Edit mode action bar */}
      {editMode && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <span className="text-sm font-medium text-blue-700">{t('detail.editingRecord')}</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              onClick={handleCancelEdit}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md bg-brand-primary px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-primary/90 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <LoadingSpinner size="sm" />
                  {t('common.saving')}
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  {t('detail.saveChanges')}
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
            {t('detail.billDetails')}
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
                    label={t('detail.ocrConfidence')}
                    value={`${(parseFloat(record.bill_ocr_confidence) * 100).toFixed(0)}%`}
                    warn={parseFloat(record.bill_ocr_confidence) < 0.7}
                    readOnly
                  />
                )}
              </>
            ) : (
              <>
                <DetailRow label={t('detail.traderName')} value={record.trader_name} />
                <DetailRow label={t('detail.traderAddress')} value={record.trader_address} />
                <DetailRow label={t('detail.invoiceNumber')} value={record.invoice_number} />
                <DetailRow label={t('detail.billDate')} value={formatDisplayDate(record.bill_date)} />
                <DetailRow
                  label={t('detail.billAmount')}
                  value={record.bill_amount ? `\u20B9${formatCurrency(record.bill_amount)}` : ''}
                />
                <DetailRow label={t('detail.currency')} value={record.currency || 'INR'} />
                {record.bill_ocr_confidence && (
                  <DetailRow
                    label={t('detail.ocrConfidence')}
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
            {t('detail.paymentDetails')}
          </h2>
          <dl className="space-y-3">
            {editMode ? (
              <>
                {getPaymentEditFields(editFields.payment_mode || record.payment_mode).map((f) =>
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
                    label={t('detail.ocrConfidence')}
                    value={`${(parseFloat(record.payment_ocr_confidence) * 100).toFixed(0)}%`}
                    warn={parseFloat(record.payment_ocr_confidence) < 0.7}
                    readOnly
                  />
                )}
              </>
            ) : (
              <>
                {record.payment_mode === 'gpay' ? (
                  <>
                    <DetailRow label={t('detail.upiTransactionId')} value={record.upi_transaction_id} />
                    <DetailRow label={t('detail.googleTransactionId')} value={record.google_transaction_id} />
                  </>
                ) : (
                  <DetailRow label={t('detail.utrNumber')} value={record.utr_number} />
                )}
                <DetailRow label={t('detail.paymentDate')} value={formatDisplayDate(record.payment_date)} />
                <DetailRow
                  label={t('extraction.paymentMode')}
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
                  label={t('detail.amountPaid')}
                  value={record.paid_amount ? `\u20B9${formatCurrency(record.paid_amount)}` : ''}
                />
                <DetailRow label={t('detail.payer')} value={record.payer_name} />
                <DetailRow label={t('detail.payee')} value={record.payee_name} />
                {record.payment_ocr_confidence && (
                  <DetailRow
                    label={t('detail.ocrConfidence')}
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
            {t('detail.originalImages')}
          </h2>
          {imagesLoading ? (
            <LoadingSpinner size="md" className="py-8" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Bill image */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-500">{t('detail.billImage')}</p>
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
                      {t('common.download')}
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
                    <p className="text-xs text-slate-400">{t('detail.imageNotAvailable')}</p>
                  </div>
                )}
              </div>

              {/* Payment image */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-500">{t('detail.paymentReceipt')}</p>
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
                      {t('common.download')}
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
                    <p className="text-xs text-slate-400">{t('detail.imageNotAvailable')}</p>
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
              {t('detail.notesAndTags')}
            </h2>
            <dl className="space-y-3">
              {editMode ? (
                <>
                  <EditRow
                    label={t('detail.notes')}
                    type="textarea"
                    value={editFields.notes}
                    onChange={(v) => handleEditField('notes', v)}
                  />
                  <EditRow
                    label={t('detail.tags')}
                    type="text"
                    value={editFields.tags}
                    onChange={(v) => handleEditField('tags', v)}
                    placeholder={t('detail.commaSeparatedTags')}
                  />
                </>
              ) : (
                <>
                  {record.notes && <DetailRow label={t('detail.notes')} value={record.notes} />}
                  {record.tags && (
                    <DetailRow
                      label={t('detail.tags')}
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
              {t('detail.proofPacket')}
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
                    {t('common.generating')}
                  </>
                ) : (
                  <>
                    <FileDown className="h-4 w-4" />
                    {t('detail.downloadProofPdf')}
                  </>
                )}
              </button>
              <button
                onClick={handleShareWhatsApp}
                disabled={pdfGenerating}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <Share2 className="h-4 w-4" />
                {t('detail.shareWhatsApp')}
              </button>
              <button
                onClick={handleShareEmail}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Mail className="h-4 w-4" />
                {t('detail.shareEmail')}
              </button>
              <button
                onClick={handleCopyProofSummary}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Copy className="h-4 w-4" />
                {t('detail.copySummary')}
              </button>
            </div>
          </div>
        )}

        {/* Audit trail */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6 lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Clock className="h-4 w-4" />
            {t('detail.auditTrail')}
          </h2>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <DetailRow
              label={t('detail.recordId')}
              value={
                <span className="font-mono text-xs">{record.record_id}</span>
              }
            />
            <DetailRow label={t('detail.created')} value={formatTimestamp(record.created_at)} />
            <DetailRow label={t('detail.lastUpdated')} value={formatTimestamp(record.updated_at)} />
            <DetailRow label={t('history.status')} value={
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                record.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
              }`}>
                {record.status === 'active' ? t('detail.active') : t('detail.archived')}
              </span>
            } />
            <DetailRow
              label={t('detail.editCount')}
              value={record.edit_count || '0'}
            />
            {record.last_edited_field && (
              <DetailRow label={t('detail.lastEditedField')} value={record.last_edited_field} />
            )}
            {record.last_edited_at && (
              <DetailRow label={t('detail.lastEditedAt')} value={formatTimestamp(record.last_edited_at)} />
            )}
            {record.archived_at && (
              <DetailRow label={t('detail.archivedAt')} value={formatTimestamp(record.archived_at)} />
            )}
            {record.archived_reason && (
              <DetailRow label={t('detail.archiveReason')} value={record.archived_reason} />
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
        {value || <span className="text-slate-300">{'\u2014'}</span>}
      </dd>
    </div>
  );
}

/** Editable field row for edit mode. */
function EditRow({ label, type, value, onChange, options, placeholder }) {
  const { t } = useTranslation();
  const inputClass =
    'w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary';
  const isDate = type === 'date';

  const dateValue = isDate && value
    ? (() => {
        try {
          const d = parse(value, 'yyyy-MM-dd', new Date());
          return isNaN(d.getTime()) ? null : d;
        } catch {
          return null;
        }
      })()
    : null;

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
        ) : isDate ? (
          <DatePicker
            selected={dateValue}
            onChange={(date) => onChange(date ? format(date, 'yyyy-MM-dd') : '')}
            dateFormat="dd/MM/yyyy"
            placeholderText={t('extraction.datePlaceholder')}
            className={inputClass}
            showMonthDropdown
            showYearDropdown
            dropdownMode="select"
            isClearable
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
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <Archive className="h-6 w-6 flex-shrink-0 text-slate-500" />
          <h2 className="text-lg font-semibold text-slate-900">{t('archiveDialog.title')}</h2>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          {t('archiveDialog.message')}
        </p>
        <div className="mt-4">
          <label htmlFor="archive-reason" className="mb-1 block text-xs font-medium text-slate-500">
            {t('archiveDialog.reasonLabel')}
          </label>
          <textarea
            id="archive-reason"
            value={archiveReason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder={t('archiveDialog.reasonPlaceholder')}
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
            {t('common.cancel')}
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
                {t('archiveDialog.archiving')}
              </>
            ) : (
              t('common.archive')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal shown when editing creates a composite key collision. */
function DuplicateEditModal({ existingRecord, onViewExisting, onDismiss }) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 flex-shrink-0 text-amber-500" />
          <h2 className="text-lg font-semibold text-slate-900">{t('duplicate.title')}</h2>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          {t('duplicate.editMessage')}
        </p>
        <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          <p>
            <span className="font-medium">{t('duplicate.trader')}</span> {existingRecord.trader_name}
          </p>
          <p>
            <span className="font-medium">{t('duplicate.invoice')}</span> {existingRecord.invoice_number}
          </p>
          <p>
            <span className="font-medium">{t('duplicate.date')}</span> {existingRecord.bill_date}
          </p>
          <p>
            <span className="font-medium">{t('duplicate.amount')}</span> \u20B9{existingRecord.bill_amount}
          </p>
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            {t('common.ok')}
          </button>
          <button
            type="button"
            onClick={onViewExisting}
            className="rounded-md border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
          >
            {t('duplicate.viewExisting')}
          </button>
        </div>
      </div>
    </div>
  );
}
