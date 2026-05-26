/**
 * Date helper utilities for formatting, parsing, and quick filter presets.
 * Uses date-fns for reliable date operations.
 */
import { format, parse, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';

/**
 * Format a YYYY-MM-DD date string as "DD MMM YYYY" (e.g., "15 May 2026").
 * Returns the original string if parsing fails.
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {string}
 */
export function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = parse(dateStr, 'yyyy-MM-dd', new Date());
    if (isNaN(date.getTime())) return dateStr;
    return format(date, 'dd MMM yyyy');
  } catch {
    return dateStr;
  }
}

/**
 * Format an ISO 8601 timestamp as "DD MMM YYYY, HH:mm" (e.g., "15 May 2026, 14:30").
 * @param {string} isoStr - ISO 8601 timestamp
 * @returns {string}
 */
export function formatTimestamp(isoStr) {
  if (!isoStr) return '';
  try {
    const date = new Date(isoStr);
    if (isNaN(date.getTime())) return isoStr;
    return format(date, 'dd MMM yyyy, HH:mm');
  } catch {
    return isoStr;
  }
}

/**
 * Parse a YYYY-MM-DD string into a Date object.
 * Returns null if the string is empty or invalid.
 * @param {string} dateStr
 * @returns {Date|null}
 */
export function parseDate(dateStr) {
  if (!dateStr) return null;
  try {
    const date = parse(dateStr, 'yyyy-MM-dd', new Date());
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/**
 * Quick filter presets that return { start, end } as YYYY-MM-DD strings.
 * "All Time" returns null bounds (no filter).
 */
export const DATE_PRESETS = [
  { labelKey: 'datePresets.thisMonth', value: 'this_month' },
  { labelKey: 'datePresets.lastMonth', value: 'last_month' },
  { labelKey: 'datePresets.last3Months', value: 'last_3_months' },
  { labelKey: 'datePresets.thisYear', value: 'this_year' },
  { labelKey: 'datePresets.allTime', value: 'all_time' },
];

/**
 * Get start and end dates for a preset filter.
 * @param {string} preset - One of the DATE_PRESETS values
 * @returns {{ start: string|null, end: string|null }}
 */
export function getPresetRange(preset) {
  const today = new Date();
  const fmt = (d) => format(d, 'yyyy-MM-dd');

  switch (preset) {
    case 'this_month':
      return { start: fmt(startOfMonth(today)), end: fmt(endOfMonth(today)) };
    case 'last_month': {
      const lastMonth = subMonths(today, 1);
      return { start: fmt(startOfMonth(lastMonth)), end: fmt(endOfMonth(lastMonth)) };
    }
    case 'last_3_months': {
      const threeMonthsAgo = subMonths(today, 3);
      return { start: fmt(startOfMonth(threeMonthsAgo)), end: fmt(endOfMonth(today)) };
    }
    case 'this_year':
      return { start: fmt(startOfYear(today)), end: fmt(endOfMonth(today)) };
    case 'all_time':
    default:
      return { start: null, end: null };
  }
}

/**
 * Convert a YYYY-MM-DD date string to DD/MM/YYYY for display in text inputs.
 * @param {string} isoDate - Date in YYYY-MM-DD format
 * @returns {string} Date in DD/MM/YYYY format, or original string if invalid
 */
export function toDateInputDisplay(isoDate) {
  if (!isoDate) return '';
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return isoDate;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/**
 * Convert a DD/MM/YYYY date string back to YYYY-MM-DD for storage.
 * @param {string} displayDate - Date in DD/MM/YYYY format
 * @returns {string} Date in YYYY-MM-DD format, or original string if invalid
 */
export function fromDateInputDisplay(displayDate) {
  if (!displayDate) return '';
  const match = displayDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return displayDate;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

/**
 * Format a number as Indian Rupee currency (e.g., "4,250.00").
 * @param {string|number} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return amount?.toString() || '';
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}
