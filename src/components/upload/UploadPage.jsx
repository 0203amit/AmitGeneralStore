import { useEffect } from 'react';
import useUpload from '../../hooks/useUpload';
import { useToast } from '../shared/Toast';
import { buildPageTitle } from '../../config/branding';
import ImageDropzone from './ImageDropzone';
import ExtractionForm from './ExtractionForm';
import LoadingSpinner from '../shared/LoadingSpinner';
import { AlertTriangle, CheckCircle, FileText } from 'lucide-react';

export default function UploadPage() {
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
  } = useUpload();
  const { addToast } = useToast();

  useEffect(() => {
    document.title = buildPageTitle('upload');
  }, []);

  // Success toast
  useEffect(() => {
    if (step === 'done') {
      addToast({ type: 'success', message: 'Record saved successfully!' });
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
      <h1 className="text-2xl font-bold text-slate-900">Upload Receipt</h1>
      <p className="mt-1 text-sm text-slate-500">
        Add a bill image and its payment receipt to create a new record.
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
          <p className="text-lg font-medium text-green-800">Record saved successfully!</p>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Upload Another
          </button>
        </div>
      )}

      {/* Main upload flow */}
      {step !== 'done' && (
        <>
          {/* Dual image zones */}
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <ImageDropzone
              label="Bill Image"
              helperText="Take a photo of the trader bill"
              captureMode="environment"
              file={billFile}
              previewUrl={billPreview}
              onFileSelect={setBillFile}
              onRemove={removeBillFile}
              disabled={isProcessing}
            />
            <ImageDropzone
              label="Payment Receipt"
              helperText="Upload the payment screenshot or photo"
              captureMode={null}
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
              Add a payment receipt to continue.
            </p>
          )}
          {!billPreview && paymentPreview && (
            <p className="mt-4 text-center text-sm text-amber-600">
              Add a bill image to continue.
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
                Extract &amp; Review
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
                  Review Extracted Fields
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
                  disabled={step === 'saving'}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-8 py-3 text-sm font-medium text-white shadow transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {step === 'saving' ? (
                    <>
                      <LoadingSpinner size="sm" />
                      Saving...
                    </>
                  ) : (
                    'Save Record'
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
            window.open(`/history/${duplicateRecord.record_id}`, '_blank');
            dismissDuplicate();
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 flex-shrink-0 text-amber-500" />
          <h2 className="text-lg font-semibold text-slate-900">Duplicate Detected</h2>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          A record with the same trader name, invoice number, and bill date already exists:
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
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onViewExisting}
            className="rounded-md border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
          >
            View Existing
          </button>
          <button
            type="button"
            onClick={onSaveAnyway}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
          >
            Save Anyway
          </button>
        </div>
      </div>
    </div>
  );
}
