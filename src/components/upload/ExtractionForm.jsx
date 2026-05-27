import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import DatePicker from 'react-datepicker';
import { parse, format } from 'date-fns';

const CONFIDENCE_THRESHOLD = 0.7;

const PAYMENT_MODE_OPTIONS = [
  { value: 'gpay', label: 'GPay' },
  { value: 'phonepe', label: 'PhonePe' },
  { value: 'paytm', label: 'Paytm' },
  { value: 'neft', label: 'NEFT' },
  { value: 'rtgs', label: 'RTGS' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

/**
 * Single field input with optional low-confidence indicator.
 */
function FieldInput({ label, value, onChange, confidence, type = 'text', required = false, disabled }) {
  const { t } = useTranslation();
  const isLowConfidence = confidence !== undefined && confidence < CONFIDENCE_THRESHOLD;
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

  const baseInputClass = `w-full rounded-md border px-3 py-2 text-sm transition-colors duration-200 focus:outline-none focus:ring-2 ${
    isLowConfidence
      ? 'border-amber-300 bg-amber-50 focus:border-amber-500 focus:ring-amber-200'
      : 'border-slate-300 bg-white focus:border-brand-primary focus:ring-brand-primary/30'
  } disabled:cursor-not-allowed disabled:bg-slate-100`;

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500">*</span>}
        {isLowConfidence && (
          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
            <AlertTriangle className="h-3 w-3" />
            {t('extraction.needsReview')}
          </span>
        )}
      </label>
      {isDate ? (
        <div className={isLowConfidence ? 'datepicker-amber' : ''}>
          <DatePicker
            selected={dateValue}
            onChange={(date) => onChange(date ? format(date, 'yyyy-MM-dd') : '')}
            dateFormat="dd/MM/yyyy"
            placeholderText={t('extraction.datePlaceholder')}
            disabled={disabled}
            className={baseInputClass}
            showMonthDropdown
            showYearDropdown
            dropdownMode="select"
            isClearable={!disabled}
          />
        </div>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={baseInputClass}
        />
      )}
    </div>
  );
}

/**
 * Display all OCR-extracted fields as editable inputs.
 * Highlights low-confidence fields (<0.7) with amber styling.
 *
 * @param {{
 *   billFields: Object,
 *   paymentFields: Object,
 *   onBillFieldChange: (field: string, value: string) => void,
 *   onPaymentFieldChange: (field: string, value: string) => void,
 *   disabled: boolean,
 * }} props
 */
export default function ExtractionForm({
  billFields,
  paymentFields,
  onBillFieldChange,
  onPaymentFieldChange,
  disabled = false,
}) {
  const { t } = useTranslation();
  const bc = billFields.field_confidences || {};
  const pc = paymentFields.field_confidences || {};

  return (
    <div className="space-y-6">
      {/* Bill Fields */}
      <fieldset className="rounded-lg border border-slate-200 p-4">
        <legend className="px-2 font-heading text-base font-semibold text-slate-800">{t('extraction.billDetails')}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldInput
            label={t('extraction.traderName')}
            value={billFields.trader_name}
            onChange={(v) => onBillFieldChange('trader_name', v)}
            confidence={bc.trader_name}
            required
            disabled={disabled}
          />
          <FieldInput
            label={t('extraction.traderAddress')}
            value={billFields.trader_address}
            onChange={(v) => onBillFieldChange('trader_address', v)}
            confidence={bc.trader_address}
            disabled={disabled}
          />
          <FieldInput
            label={t('extraction.invoiceNumber')}
            value={billFields.invoice_number}
            onChange={(v) => onBillFieldChange('invoice_number', v)}
            confidence={bc.invoice_number}
            required
            disabled={disabled}
          />
          <FieldInput
            label={t('extraction.billDate')}
            value={billFields.bill_date}
            onChange={(v) => onBillFieldChange('bill_date', v)}
            confidence={bc.bill_date}
            type="date"
            required
            disabled={disabled}
          />
          <FieldInput
            label={t('extraction.billAmount')}
            value={billFields.bill_amount}
            onChange={(v) => onBillFieldChange('bill_amount', v)}
            confidence={bc.bill_amount}
            type="number"
            required
            disabled={disabled}
          />
          <FieldInput
            label={t('extraction.currency')}
            value={billFields.currency}
            onChange={(v) => onBillFieldChange('currency', v)}
            confidence={bc.currency}
            disabled={disabled}
          />
        </div>
      </fieldset>

      {/* Payment Fields */}
      <fieldset className="rounded-lg border border-slate-200 p-4">
        <legend className="px-2 font-heading text-base font-semibold text-slate-800">{t('extraction.paymentDetails')}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {paymentFields.payment_mode === 'gpay' ? (
            <>
              <FieldInput
                label={t('extraction.upiTransactionId')}
                value={paymentFields.upi_transaction_id}
                onChange={(v) => onPaymentFieldChange('upi_transaction_id', v)}
                confidence={pc.upi_transaction_id}
                disabled={disabled}
              />
              <FieldInput
                label={t('extraction.googleTransactionId')}
                value={paymentFields.google_transaction_id}
                onChange={(v) => onPaymentFieldChange('google_transaction_id', v)}
                confidence={pc.google_transaction_id}
                disabled={disabled}
              />
            </>
          ) : (
            <FieldInput
              label={t('extraction.utrNumber')}
              value={paymentFields.utr_number}
              onChange={(v) => onPaymentFieldChange('utr_number', v)}
              confidence={pc.utr_number}
              required
              disabled={disabled}
            />
          )}
          <FieldInput
            label={t('extraction.paymentDate')}
            value={paymentFields.payment_date}
            onChange={(v) => onPaymentFieldChange('payment_date', v)}
            confidence={pc.payment_date}
            type="date"
            required
            disabled={disabled}
          />
          {/* Payment Mode: dropdown */}
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
              {t('extraction.paymentMode')} <span className="text-red-500">*</span>
              {(pc.payment_mode || 0) < CONFIDENCE_THRESHOLD && (
                <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                  <AlertTriangle className="h-3 w-3" />
                  {t('extraction.needsReview')}
                </span>
              )}
            </label>
            <select
              value={paymentFields.payment_mode}
              onChange={(e) => onPaymentFieldChange('payment_mode', e.target.value)}
              disabled={disabled}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm transition-colors duration-200 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              {PAYMENT_MODE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <FieldInput
            label={t('extraction.paidAmount')}
            value={paymentFields.paid_amount}
            onChange={(v) => onPaymentFieldChange('paid_amount', v)}
            confidence={pc.paid_amount}
            type="number"
            required
            disabled={disabled}
          />
          <FieldInput
            label={t('extraction.payerName')}
            value={paymentFields.payer_name}
            onChange={(v) => onPaymentFieldChange('payer_name', v)}
            confidence={pc.payer_name}
            disabled={disabled}
          />
          <FieldInput
            label={t('extraction.payeeName')}
            value={paymentFields.payee_name}
            onChange={(v) => onPaymentFieldChange('payee_name', v)}
            confidence={pc.payee_name}
            disabled={disabled}
          />
        </div>
      </fieldset>
    </div>
  );
}
