import { AlertTriangle } from 'lucide-react';

const CONFIDENCE_THRESHOLD = 0.7;

const PAYMENT_MODE_OPTIONS = [
  { value: 'gpay', label: 'GPay' },
  { value: 'phonepe', label: 'PhonePe' },
  { value: 'paytm', label: 'Paytm' },
  { value: 'net_banking', label: 'Net Banking' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

/**
 * Single field input with optional low-confidence indicator.
 */
function FieldInput({ label, value, onChange, confidence, type = 'text', required = false, disabled }) {
  const isLowConfidence = confidence !== undefined && confidence < CONFIDENCE_THRESHOLD;

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500">*</span>}
        {isLowConfidence && (
          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
            <AlertTriangle className="h-3 w-3" />
            Needs review
          </span>
        )}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full rounded-md border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 ${
          isLowConfidence
            ? 'border-amber-300 bg-amber-50 focus:border-amber-500 focus:ring-amber-200'
            : 'border-slate-300 bg-white focus:border-indigo-500 focus:ring-indigo-200'
        } disabled:cursor-not-allowed disabled:bg-slate-100`}
      />
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
  const bc = billFields.field_confidences || {};
  const pc = paymentFields.field_confidences || {};

  return (
    <div className="space-y-6">
      {/* Bill Fields */}
      <fieldset className="rounded-lg border border-slate-200 p-4">
        <legend className="px-2 text-sm font-semibold text-slate-800">Bill Details</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldInput
            label="Trader Name"
            value={billFields.trader_name}
            onChange={(v) => onBillFieldChange('trader_name', v)}
            confidence={bc.trader_name}
            required
            disabled={disabled}
          />
          <FieldInput
            label="Trader Address"
            value={billFields.trader_address}
            onChange={(v) => onBillFieldChange('trader_address', v)}
            confidence={bc.trader_address}
            disabled={disabled}
          />
          <FieldInput
            label="Invoice Number"
            value={billFields.invoice_number}
            onChange={(v) => onBillFieldChange('invoice_number', v)}
            confidence={bc.invoice_number}
            required
            disabled={disabled}
          />
          <FieldInput
            label="Bill Date"
            value={billFields.bill_date}
            onChange={(v) => onBillFieldChange('bill_date', v)}
            confidence={bc.bill_date}
            type="date"
            required
            disabled={disabled}
          />
          <FieldInput
            label="Bill Amount (₹)"
            value={billFields.bill_amount}
            onChange={(v) => onBillFieldChange('bill_amount', v)}
            confidence={bc.bill_amount}
            type="number"
            required
            disabled={disabled}
          />
          <FieldInput
            label="Currency"
            value={billFields.currency}
            onChange={(v) => onBillFieldChange('currency', v)}
            confidence={bc.currency}
            disabled={disabled}
          />
        </div>
      </fieldset>

      {/* Payment Fields */}
      <fieldset className="rounded-lg border border-slate-200 p-4">
        <legend className="px-2 text-sm font-semibold text-slate-800">Payment Details</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldInput
            label="UTR Number"
            value={paymentFields.utr_number}
            onChange={(v) => onPaymentFieldChange('utr_number', v)}
            confidence={pc.utr_number}
            required
            disabled={disabled}
          />
          <FieldInput
            label="Payment Date"
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
              Payment Mode <span className="text-red-500">*</span>
              {(pc.payment_mode || 0) < CONFIDENCE_THRESHOLD && (
                <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                  <AlertTriangle className="h-3 w-3" />
                  Needs review
                </span>
              )}
            </label>
            <select
              value={paymentFields.payment_mode}
              onChange={(e) => onPaymentFieldChange('payment_mode', e.target.value)}
              disabled={disabled}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              {PAYMENT_MODE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <FieldInput
            label="Paid Amount (₹)"
            value={paymentFields.paid_amount}
            onChange={(v) => onPaymentFieldChange('paid_amount', v)}
            confidence={pc.paid_amount}
            type="number"
            required
            disabled={disabled}
          />
          <FieldInput
            label="Payer Name"
            value={paymentFields.payer_name}
            onChange={(v) => onPaymentFieldChange('payer_name', v)}
            confidence={pc.payer_name}
            disabled={disabled}
          />
          <FieldInput
            label="Payee Name"
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
