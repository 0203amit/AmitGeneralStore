/**
 * RecordsTable with sortable columns, pagination controls, and responsive layout.
 * Desktop: full columns. Mobile: stacked date+trader, amount+mode.
 * Clickable trader → detail page. Clickable invoice → copy to clipboard.
 * "Needs review" badge, colored payment mode badges.
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowUpDown, ArrowUp, ArrowDown, Copy, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDisplayDate, formatCurrency } from '../../utils/dateHelpers';
import { useToast } from '../shared/Toast';

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

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/**
 * @param {{
 *   records: Object[],
 *   sortBy: string,
 *   sortDir: 'asc'|'desc',
 *   onSortChange: (field: string) => void,
 *   page: number,
 *   pageSize: number,
 *   totalFiltered: number,
 *   totalPages: number,
 *   onPageChange: (p: number) => void,
 *   onPageSizeChange: (s: number) => void,
 *   selectedIds?: Set<string>,
 *   onToggleSelect?: (id: string) => void,
 *   onToggleSelectAll?: () => void,
 * }} props
 */
export default function RecordsTable({
  records,
  sortBy,
  sortDir,
  onSortChange,
  page,
  pageSize,
  totalFiltered,
  totalPages,
  onPageChange,
  onPageSizeChange,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addToast } = useToast();

  function handleCopyInvoice(e, invoiceNumber) {
    e.stopPropagation();
    navigator.clipboard.writeText(invoiceNumber).then(() => {
      addToast({ type: 'info', message: t('history.copied', { value: invoiceNumber }) });
    });
  }

  function SortIcon({ field }) {
    if (sortBy !== field) return <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />;
    return sortDir === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5 text-brand-primary" />
      : <ArrowDown className="h-3.5 w-3.5 text-brand-primary" />;
  }

  function SortableHeader({ field, children, className = '' }) {
    return (
      <th
        className={`cursor-pointer select-none px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 transition hover:text-brand-primary ${className}`}
        onClick={() => onSortChange(field)}
      >
        <div className="flex items-center gap-1">
          {children}
          <SortIcon field={field} />
        </div>
      </th>
    );
  }

  if (records.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-500">{t('history.noRecordsFound')}</p>
      </div>
    );
  }

  const startRecord = (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalFiltered);

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              {onToggleSelect && (
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={records.length > 0 && selectedIds?.size === records.length}
                    onChange={(e) => { e.stopPropagation(); onToggleSelectAll?.(); }}
                    className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                  />
                </th>
              )}
              <SortableHeader field="bill_date">{t('history.date')}</SortableHeader>
              <SortableHeader field="trader_name">{t('history.trader')}</SortableHeader>
              <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                {t('history.invoice')}
              </th>
              <SortableHeader field="bill_amount">{t('history.amount')}</SortableHeader>
              <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                {t('history.mode')}
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                {t('history.utr')}
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                {t('history.status')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.map((record) => (
              <tr
                key={record.record_id}
                onClick={() => navigate(`/history/${record.record_id}`)}
                className="cursor-pointer transition hover:bg-slate-50"
              >
                {onToggleSelect && (
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds?.has(record.record_id) || false}
                      onChange={() => onToggleSelect(record.record_id)}
                      className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                    />
                  </td>
                )}
                <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-700">
                  {formatDisplayDate(record.bill_date)}
                </td>
                <td className="px-3 py-3 text-sm font-medium text-slate-900">
                  {record.trader_name || '\u2014'}
                </td>
                <td className="px-3 py-3 text-sm text-slate-600">
                  <button
                    onClick={(e) => handleCopyInvoice(e, record.invoice_number)}
                    className="group inline-flex items-center gap-1 hover:text-brand-primary"
                    title={t('history.clickToCopy')}
                  >
                    {record.invoice_number || '\u2014'}
                    <Copy className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
                  </button>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-sm font-medium text-slate-900">
                  \u20B9{formatCurrency(record.bill_amount)}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      PAYMENT_MODE_COLORS[record.payment_mode] || PAYMENT_MODE_COLORS.other
                    }`}
                  >
                    {PAYMENT_MODE_LABELS[record.payment_mode] || record.payment_mode}
                  </span>
                </td>
                <td className="px-3 py-3 text-sm text-slate-600">
                  {record.utr_number || '\u2014'}
                </td>
                <td className="px-3 py-3">
                  {record.needs_review === 'true' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      <AlertTriangle className="h-3 w-3" />
                      {t('extraction.needsReview')}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout */}
      <div className="space-y-2 md:hidden">
        {records.map((record) => (
          <div
            key={record.record_id}
            className="rounded-lg border border-slate-200 bg-white p-3 transition active:bg-slate-50"
          >
            <div className="flex gap-3">
              {onToggleSelect && (
                <div className="flex items-start pt-0.5" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds?.has(record.record_id) || false}
                    onChange={() => onToggleSelect(record.record_id)}
                    className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                  />
                </div>
              )}
              <div
                className="flex-1 cursor-pointer"
                onClick={() => navigate(`/history/${record.record_id}`)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {record.trader_name || t('history.unknownTrader')}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDisplayDate(record.bill_date)}
                      {record.invoice_number && ` \u00b7 ${record.invoice_number}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">
                      \u20B9{formatCurrency(record.bill_amount)}
                    </p>
                    <span
                      className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        PAYMENT_MODE_COLORS[record.payment_mode] || PAYMENT_MODE_COLORS.other
                      }`}
                    >
                      {PAYMENT_MODE_LABELS[record.payment_mode] || record.payment_mode}
                    </span>
                  </div>
                </div>
                {record.needs_review === 'true' && (
                  <div className="mt-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      <AlertTriangle className="h-3 w-3" />
                      {t('extraction.needsReview')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination controls */}
      <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>
            {t('history.pagination', { start: startRecord, end: endRecord, total: totalFiltered })}
          </span>
          <span className="text-slate-300">|</span>
          <label className="flex items-center gap-1">
            <span>{t('history.perPage')}</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded border border-slate-200 px-1.5 py-0.5 text-sm focus:border-brand-primary focus:outline-none"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="rounded-md border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {generatePageNumbers(page, totalPages).map((p, idx) =>
            p === '...' ? (
              <span key={`ellipsis-${idx}`} className="px-1 text-sm text-slate-400">
                ...
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`rounded-md border px-2.5 py-1 text-sm transition ${
                  p === page
                    ? 'border-brand-primary bg-brand-primary text-white'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {p}
              </button>
            )
          )}
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="rounded-md border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Generate a compact page number array with ellipses for large page counts.
 * Always shows first, last, and 1 page on each side of current.
 */
function generatePageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const result = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      result.push('...');
    }
    result.push(sorted[i]);
  }
  return result;
}
