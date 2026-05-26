import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useUpload from '../../hooks/useUpload';
import { useToast } from '../shared/Toast';
import { buildPageTitle } from '../../config/branding';
import ImageDropzone from './ImageDropzone';
import ExtractionForm from './ExtractionForm';
import LoadingSpinner from '../shared/LoadingSpinner';
import { AlertTriangle, CheckCircle, FileText } from 'lucide-react';

export default function UploadPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    billFile,
    paymentFile,
    billPreview,
    paymentPreview,
    setBillFile,
    setPaymentFile,
    removeBillFile,
    removePaymentFile,
    billFields,
    paymentFields,
    onBillFieldChange,
    onPaymentFieldChange,
    step,
    progress,
    error,
    duplicateRecord,
    extractAndReview,
    save,
    reset,
    dismissDuplicate,
    canSave,
  } = useUpload();
  const { addToast } = useToast();

  useEffect(() => {
    document.title = buildPageTitle('upload');
  }, []);

  // Success toast
  useEffect(() => {
    if (step === 'done') {
      addToast({ type: 'success', message: t('upload.savedSuccess') });
    }
  }, [step, addToast]);

  // Error toast
  useEffect(() => {
    if (error) {
      addToast({ type: 'error', message: error });
    }
  }, [error, addToast]);

  const canExtract = !!billPreview && !!paymentPreview && step === 'select';
  const isProcessing = step === 'extracting' || step === 'saving';

  return (
    <div className="px-4 py-6 sm:py-8">
      <h1 className="text-2xl font-bold text-slate-900">{t('upload.title')}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {t('upload.subtitle')}
      </p>

      {/* Error banner */}
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Success state */}
      {step === 'done' && (
        <div className="mt-8 flex flex-col items-center gap-4 rounded-lg border border-green-200 bg-green-50 p-8">
          <CheckCircle className="h-12 w-12 text-green-600" />
          <p className="text-lg font-medium text-green-800">{t('upload.savedSuccess')}</p>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {t('upload.uploadAnother')}
          </button>
        </div>
      )}

      {/* Main upload flow */}
      {step !== 'done' && (
        <>
          {/* Dual image zones */}
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <ImageDropzone
              label={t('upload.billImage')}
              helperText={t('upload.billHelperText')}
              captureMode="environment"
              file={billFile}
              previewUrl={billPreview}
              onFileSelect={setBillFile}
              onRemove={removeBillFile}
              disabled={isProcessing}
            />
            <ImageDropzone
              label={t('upload.paymentReceipt')}
              helperText={t('upload.paymentHelperText')}
              captureMode="environment"
              file={paymentFile}
              previewUrl={paymentPreview}
              onFileSelect={setPaymentFile}
              onRemove={removePaymentFile}
              disabled={isProcessing}
            />
          </div>

          {/* Hint when only one image selected */}
          {billPreview && !paymentPreview && (
            <p className="mt-4 text-center text-sm text-amber-600">
              {t('upload.addPaymentToContinue')}
            </p>
          )}
          {!billPreview && paymentPreview && (
            <p className="mt-4 text-center text-sm text-amber-600">
              {t('upload.addBillToContinue')}
            </p>
          )}

          {/* Extract & Review button */}
          {step === 'select' && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={extractAndReview}
                disabled={!canExtract}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-8 py-3 text-sm font-medium text-white shadow transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileText className="h-4 w-4" />
                {t('upload.extractAndReview')}
              </button>
            </div>
          )}

          {/* Progress during extraction */}
          {step === 'extracting' && (
            <div className="mt-6 flex flex-col items-center gap-3">
              <LoadingSpinner size="lg" />
              <div className="text-center text-sm text-slate-600">
                {progress.bill && <p>{progress.bill}</p>}
                {progress.payment && <p>{progress.payment}</p>}
              </div>
            </div>
          )}

          {/* Extraction form for review */}
          {(step === 'review' || step === 'saving') && billFields && paymentFields && (
            <>
              <div className="mt-8">
                <h2 className="mb-4 text-lg font-semibold text-slate-800">
                  {t('upload.reviewExtractedFields')}
                </h2>
                <ExtractionForm
                  billFields={billFields}
                  paymentFields={paymentFields}
                  onBillFieldChange={onBillFieldChange}
                  onPaymentFieldChange={onPaymentFieldChange}
                  disabled={step === 'saving'}
                />
              </div>

              {/* Save button */}
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => save(false)}
                  disabled={step === 'saving' || !canSave}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-8 py-3 text-sm font-medium text-white shadow transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {step === 'saving' ? (
                    <>
                      <LoadingSpinner size="sm" />
                      {t('common.saving')}
                    </>
                  ) : (
                    t('upload.saveRecord')
                  )}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* Duplicate detection modal */}
      {duplicateRecord && (
        <DuplicateModal
          existingRecord={duplicateRecord}
          onViewExisting={() => {
            dismissDuplicate();
            navigate(`/history/${duplicateRecord.record_id}`);
          }}
          onSaveAnyway={() => {
            dismissDuplicate();
            save(true);
          }}
          onCancel={dismissDuplicate}
        />
      )}
    </div>
  );
}

/** Modal shown when a duplicate composite key is detected. */
function DuplicateModal({ existingRecord, onViewExisting, onSaveAnyway, onCancel }) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 flex-shrink-0 text-amber-500" />
          <h2 className="text-lg font-semibold text-slate-900">{t('duplicate.title')}</h2>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          {t('duplicate.message')}
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
            <span className="font-medium">{t('duplicate.amount')}</span> ₹{existingRecord.bill_amount}
          </p>
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onViewExisting}
            className="rounded-md border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
          >
            {t('duplicate.viewExisting')}
          </button>
          <button
            type="button"
            onClick={onSaveAnyway}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
          >
            {t('duplicate.saveAnyway')}
          </button>
        </div>
      </div>
    </div>
  );
}
