/**
 * Hook orchestrating the full upload workflow:
 * image selection → processing → parallel OCR → field review → duplicate check → atomic save.
 *
 * State machine: select → extracting → review → saving → done
 */
import { useState, useCallback, useRef } from 'react';
import { processImage } from '../utils/imageProcessor';
import { extractBillFields, extractPaymentFields } from '../services/ocrService';
import { saveRecord } from '../services/recordService';

export default function useUpload() {
  // Image state
  const [billFile, setBillFileState] = useState(null);
  const [paymentFile, setPaymentFileState] = useState(null);
  const [billPreview, setBillPreview] = useState(null);
  const [paymentPreview, setPaymentPreview] = useState(null);
  const billBlobRef = useRef(null);
  const paymentBlobRef = useRef(null);

  // OCR state
  const [billFields, setBillFields] = useState(null);
  const [paymentFields, setPaymentFields] = useState(null);

  // Workflow state
  const [step, setStep] = useState('select');
  const [progress, setProgress] = useState({ bill: '', payment: '' });
  const [error, setError] = useState(null);
  const [duplicateRecord, setDuplicateRecord] = useState(null);

  // File selection with immediate image processing
  const setBillFile = useCallback(async (file) => {
    if (!file) return;
    try {
      setBillFileState(file);
      setError(null);
      const { blob, previewUrl } = await processImage(file);
      billBlobRef.current = blob;
      setBillPreview(previewUrl);
      setStep('select');
      setBillFields(null);
    } catch (err) {
      setError(`Failed to process bill image: ${err.message}`);
    }
  }, []);

  const setPaymentFile = useCallback(async (file) => {
    if (!file) return;
    try {
      setPaymentFileState(file);
      setError(null);
      const { blob, previewUrl } = await processImage(file);
      paymentBlobRef.current = blob;
      setPaymentPreview(previewUrl);
      setStep('select');
      setPaymentFields(null);
    } catch (err) {
      setError(`Failed to process payment image: ${err.message}`);
    }
  }, []);

  const removeBillFile = useCallback(() => {
    if (billPreview) URL.revokeObjectURL(billPreview);
    setBillFileState(null);
    setBillPreview(null);
    billBlobRef.current = null;
    setBillFields(null);
    setStep('select');
    setError(null);
  }, [billPreview]);

  const removePaymentFile = useCallback(() => {
    if (paymentPreview) URL.revokeObjectURL(paymentPreview);
    setPaymentFileState(null);
    setPaymentPreview(null);
    paymentBlobRef.current = null;
    setPaymentFields(null);
    setStep('select');
    setError(null);
  }, [paymentPreview]);

  // Field change handlers for the review form
  const onBillFieldChange = useCallback((field, value) => {
    setBillFields((prev) => (prev ? { ...prev, [field]: value } : prev));
  }, []);

  const onPaymentFieldChange = useCallback((field, value) => {
    setPaymentFields((prev) => (prev ? { ...prev, [field]: value } : prev));
  }, []);

  // Extract: run both OCR calls in parallel
  const extractAndReview = useCallback(async () => {
    // Defense: re-validate both images are present
    if (!billBlobRef.current || !paymentBlobRef.current) {
      setError('Both bill and payment images are required');
      return;
    }

    setStep('extracting');
    setError(null);
    setProgress({ bill: 'Extracting bill fields...', payment: 'Extracting payment fields...' });

    try {
      const [billResult, paymentResult] = await Promise.all([
        extractBillFields(billBlobRef.current),
        extractPaymentFields(paymentBlobRef.current),
      ]);

      setBillFields(billResult);
      setPaymentFields(paymentResult);
      setProgress({ bill: '', payment: '' });
      setStep('review');
    } catch (err) {
      setError(`OCR extraction failed: ${err.message}`);
      setStep('select');
      setProgress({ bill: '', payment: '' });
    }
  }, []);

  // Save: atomic save with duplicate detection
  const save = useCallback(
    async (forceSave = false) => {
      // Defense: re-validate both images are present
      if (!billBlobRef.current || !paymentBlobRef.current) {
        setError('Both bill and payment images are required');
        return;
      }
      if (!billFields || !paymentFields) {
        setError('OCR extraction must be completed before saving');
        return;
      }

      // Validate required fields before saving
      const missing = [];
      if (!billFields.trader_name) missing.push('Trader Name');
      if (!billFields.invoice_number) missing.push('Invoice Number');
      if (!billFields.bill_date) missing.push('Bill Date');
      if (!billFields.bill_amount) missing.push('Bill Amount');
      if (!paymentFields.payment_date) missing.push('Payment Date');
      if (!paymentFields.payment_mode) missing.push('Payment Mode');
      if (!paymentFields.paid_amount) missing.push('Paid Amount');
      if (paymentFields.payment_mode !== 'gpay' && !paymentFields.utr_number) {
        missing.push('UTR Number');
      }
      if (missing.length > 0) {
        setError(`Required fields missing: ${missing.join(', ')}`);
        return;
      }

      setStep('saving');
      setError(null);
      setDuplicateRecord(null);

      try {
        await saveRecord({
          billBlob: billBlobRef.current,
          paymentBlob: paymentBlobRef.current,
          billFields,
          paymentFields,
          forceSave,
        });
        setStep('done');
      } catch (err) {
        if (err.code === 'DUPLICATE_DETECTED') {
          setDuplicateRecord(err.existingRecord);
          setStep('review');
        } else {
          setError(err.message);
          setStep('review');
        }
      }
    },
    [billFields, paymentFields],
  );

  const dismissDuplicate = useCallback(() => {
    setDuplicateRecord(null);
  }, []);

  const reset = useCallback(() => {
    if (billPreview) URL.revokeObjectURL(billPreview);
    if (paymentPreview) URL.revokeObjectURL(paymentPreview);
    setBillFileState(null);
    setPaymentFileState(null);
    setBillPreview(null);
    setPaymentPreview(null);
    billBlobRef.current = null;
    paymentBlobRef.current = null;
    setBillFields(null);
    setPaymentFields(null);
    setStep('select');
    setProgress({ bill: '', payment: '' });
    setError(null);
    setDuplicateRecord(null);
  }, [billPreview, paymentPreview]);

  // Computed: can the form be saved? All required fields must be filled.
  const canSave = !!(
    billFields &&
    paymentFields &&
    billFields.trader_name &&
    billFields.invoice_number &&
    billFields.bill_date &&
    billFields.bill_amount &&
    paymentFields.payment_date &&
    paymentFields.payment_mode &&
    paymentFields.paid_amount &&
    (paymentFields.payment_mode === 'gpay' || paymentFields.utr_number)
  );

  return {
    // Image state
    billFile,
    paymentFile,
    billPreview,
    paymentPreview,
    setBillFile,
    setPaymentFile,
    removeBillFile,
    removePaymentFile,

    // OCR state
    billFields,
    paymentFields,
    onBillFieldChange,
    onPaymentFieldChange,

    // Workflow state
    step,
    progress,
    error,
    duplicateRecord,
    canSave,

    // Actions
    extractAndReview,
    save,
    reset,
    dismissDuplicate,
  };
}
