/**
 * FilterBar for the History page.
 * Provides free-text search, date range with quick presets,
 * payment mode multi-select, amount range, trader dropdown,
 * removable filter chips, and "Clear All Filters" button.
 */
import { useState, useRef, useEffect } from 'react';
import {
  Search,
  Calendar,
  Filter,
  X,
  ChevronDown,
} from 'lucide-react';
import { DATE_PRESETS, getPresetRange, formatDisplayDate } from '../../utils/dateHelpers';

const PAYMENT_MODES = [
  { value: 'gpay', label: 'GPay' },
  { value: 'phonepe', label: 'PhonePe' },
  { value: 'paytm', label: 'Paytm' },
  { value: 'net_banking', label: 'Net Banking' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

/**
 * @param {{
 *   searchQuery: string,
 *   onSearchChange: (q: string) => void,
 *   filters: Object,
 *   onFiltersChange: (f: Object) => void,
 *   uniqueTraders: string[],
 * }} props
 */
export default function FilterBar({
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  uniqueTraders = [],
}) {
  const [showFilters, setShowFilters] = useState(false);
  const [traderDropdownOpen, setTraderDropdownOpen] = useState(false);
  const traderRef = useRef(null);

  // Close trader dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (traderRef.current && !traderRef.current.contains(e.target)) {
        setTraderDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasActiveFilters =
    filters.dateStart ||
    filters.dateEnd ||
    (filters.paymentModes && filters.paymentModes.length > 0) ||
    filters.amountMin ||
    filters.amountMax ||
    (filters.traders && filters.traders.length > 0);

  function clearAllFilters() {
    onFiltersChange({
      ...filters,
      dateStart: null,
      dateEnd: null,
      paymentModes: [],
      amountMin: null,
      amountMax: null,
      traders: [],
    });
  }

  function applyPreset(presetValue) {
    const { start, end } = getPresetRange(presetValue);
    onFiltersChange({ ...filters, dateStart: start, dateEnd: end });
  }

  function togglePaymentMode(mode) {
    const current = filters.paymentModes || [];
    const updated = current.includes(mode)
      ? current.filter((m) => m !== mode)
      : [...current, mode];
    onFiltersChange({ ...filters, paymentModes: updated });
  }

  function toggleTrader(trader) {
    const current = filters.traders || [];
    const updated = current.includes(trader)
      ? current.filter((t) => t !== trader)
      : [...current, trader];
    onFiltersChange({ ...filters, traders: updated });
  }

  function removeChip(type, value) {
    switch (type) {
      case 'date':
        onFiltersChange({ ...filters, dateStart: null, dateEnd: null });
        break;
      case 'paymentMode':
        onFiltersChange({
          ...filters,
          paymentModes: (filters.paymentModes || []).filter((m) => m !== value),
        });
        break;
      case 'amount':
        onFiltersChange({ ...filters, amountMin: null, amountMax: null });
        break;
      case 'trader':
        onFiltersChange({
          ...filters,
          traders: (filters.traders || []).filter((t) => t !== value),
        });
        break;
    }
  }

  // Build active filter chips
  const chips = [];
  if (filters.dateStart || filters.dateEnd) {
    const label =
      filters.dateStart && filters.dateEnd
        ? `${formatDisplayDate(filters.dateStart)} - ${formatDisplayDate(filters.dateEnd)}`
        : filters.dateStart
          ? `From ${formatDisplayDate(filters.dateStart)}`
          : `Until ${formatDisplayDate(filters.dateEnd)}`;
    chips.push({ type: 'date', label, value: null });
  }
  (filters.paymentModes || []).forEach((mode) => {
    const modeLabel = PAYMENT_MODES.find((m) => m.value === mode)?.label || mode;
    chips.push({ type: 'paymentMode', label: modeLabel, value: mode });
  });
  if (filters.amountMin || filters.amountMax) {
    const parts = [];
    if (filters.amountMin) parts.push(`Min: ₹${filters.amountMin}`);
    if (filters.amountMax) parts.push(`Max: ₹${filters.amountMax}`);
    chips.push({ type: 'amount', label: parts.join(' - '), value: null });
  }
  (filters.traders || []).forEach((trader) => {
    chips.push({ type: 'trader', label: trader, value: trader });
  });

  return (
    <div className="space-y-3">
      {/* Search bar + filter toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by trader, invoice, UTR, payer, payee..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm placeholder:text-slate-400 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters((prev) => !prev)}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
            hasActiveFilters
              ? 'border-brand-primary bg-brand-primary/5 text-brand-primary'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">Filters</span>
          {hasActiveFilters && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-primary text-xs text-white">
              {chips.length}
            </span>
          )}
        </button>
      </div>

      {/* Active filter chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip, idx) => (
            <span
              key={`${chip.type}-${chip.value || idx}`}
              className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-medium text-brand-primary"
            >
              {chip.label}
              <button
                onClick={() => removeChip(chip.type, chip.value)}
                className="ml-0.5 hover:text-red-600"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            onClick={clearAllFilters}
            className="text-xs font-medium text-slate-500 hover:text-red-600"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Expanded filter panel */}
      {showFilters && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Date range */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                <Calendar className="mr-1 inline h-3.5 w-3.5" />
                Date Range
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {DATE_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => applyPreset(preset.value)}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 transition hover:border-brand-primary hover:text-brand-primary"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={filters.dateStart || ''}
                  onChange={(e) =>
                    onFiltersChange({ ...filters, dateStart: e.target.value || null })
                  }
                  className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs focus:border-brand-primary focus:outline-none"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={filters.dateEnd || ''}
                  onChange={(e) =>
                    onFiltersChange({ ...filters, dateEnd: e.target.value || null })
                  }
                  className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs focus:border-brand-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Payment mode */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                Payment Mode
              </label>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_MODES.map((mode) => {
                  const isSelected = (filters.paymentModes || []).includes(mode.value);
                  return (
                    <label
                      key={mode.value}
                      className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition ${
                        isSelected
                          ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => togglePaymentMode(mode.value)}
                        className="sr-only"
                      />
                      {mode.label}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Amount range */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                Amount Range (₹)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.amountMin || ''}
                  onChange={(e) =>
                    onFiltersChange({ ...filters, amountMin: e.target.value || null })
                  }
                  className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs focus:border-brand-primary focus:outline-none"
                  min="0"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.amountMax || ''}
                  onChange={(e) =>
                    onFiltersChange({ ...filters, amountMax: e.target.value || null })
                  }
                  className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs focus:border-brand-primary focus:outline-none"
                  min="0"
                />
              </div>
            </div>

            {/* Trader multi-select dropdown */}
            <div ref={traderRef}>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                Trader
              </label>
              <button
                onClick={() => setTraderDropdownOpen((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-600 hover:border-slate-300"
              >
                <span>
                  {(filters.traders || []).length > 0
                    ? `${filters.traders.length} selected`
                    : 'All traders'}
                </span>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {traderDropdownOpen && (
                <div className="absolute z-30 mt-1 max-h-48 w-56 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                  {uniqueTraders.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-slate-400">No traders found</p>
                  ) : (
                    uniqueTraders.map((trader) => {
                      const isSelected = (filters.traders || []).includes(trader);
                      return (
                        <label
                          key={trader}
                          className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleTrader(trader)}
                            className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                          />
                          {trader}
                        </label>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
