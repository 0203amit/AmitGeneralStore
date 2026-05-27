import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatDisplayDate,
  formatTimestamp,
  parseDate,
  getPresetRange,
  toDateInputDisplay,
  fromDateInputDisplay,
  formatCurrency,
} from './dateHelpers';

describe('formatDisplayDate', () => {
  it('returns empty string for falsy input', () => {
    expect(formatDisplayDate('')).toBe('');
    expect(formatDisplayDate(null)).toBe('');
  });

  it('formats YYYY-MM-DD as "DD MMM YYYY"', () => {
    expect(formatDisplayDate('2026-05-15')).toBe('15 May 2026');
  });

  it('returns original string for invalid date', () => {
    expect(formatDisplayDate('not-a-date')).toBe('not-a-date');
  });
});

describe('formatTimestamp', () => {
  it('returns empty string for falsy input', () => {
    expect(formatTimestamp('')).toBe('');
  });

  it('formats ISO string with date and time', () => {
    const result = formatTimestamp('2026-05-15T14:30:00.000Z');
    expect(result).toMatch(/15 May 2026/);
    expect(result).toMatch(/\d{2} \w{3} \d{4}, \d{2}:\d{2}/);
  });
});

describe('parseDate', () => {
  it('returns null for empty string', () => {
    expect(parseDate('')).toBeNull();
    expect(parseDate(null)).toBeNull();
  });

  it('parses YYYY-MM-DD into a Date object', () => {
    const result = parseDate('2026-05-15');
    expect(result).toBeInstanceOf(Date);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(4); // 0-indexed
    expect(result.getDate()).toBe(15);
  });

  it('returns null for invalid date string', () => {
    expect(parseDate('not-a-date')).toBeNull();
  });
});

describe('getPresetRange', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 15)); // May 15, 2026
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns current month range for "this_month"', () => {
    const { start, end } = getPresetRange('this_month');
    expect(start).toBe('2026-05-01');
    expect(end).toBe('2026-05-31');
  });

  it('returns last month range for "last_month"', () => {
    const { start, end } = getPresetRange('last_month');
    expect(start).toBe('2026-04-01');
    expect(end).toBe('2026-04-30');
  });

  it('returns last 3 months range for "last_3_months"', () => {
    const { start, end } = getPresetRange('last_3_months');
    expect(start).toBe('2026-02-01');
    expect(end).toBe('2026-05-31');
  });

  it('returns year-to-date range for "this_year"', () => {
    const { start, end } = getPresetRange('this_year');
    expect(start).toBe('2026-01-01');
    expect(end).toBe('2026-05-31');
  });

  it('returns null bounds for "all_time"', () => {
    const { start, end } = getPresetRange('all_time');
    expect(start).toBeNull();
    expect(end).toBeNull();
  });
});

describe('toDateInputDisplay', () => {
  it('converts YYYY-MM-DD to DD/MM/YYYY', () => {
    expect(toDateInputDisplay('2026-05-15')).toBe('15/05/2026');
  });

  it('returns empty string for falsy input', () => {
    expect(toDateInputDisplay('')).toBe('');
  });

  it('returns original for non-matching format', () => {
    expect(toDateInputDisplay('15/05/2026')).toBe('15/05/2026');
  });
});

describe('fromDateInputDisplay', () => {
  it('converts DD/MM/YYYY to YYYY-MM-DD', () => {
    expect(fromDateInputDisplay('15/05/2026')).toBe('2026-05-15');
  });

  it('returns empty string for falsy input', () => {
    expect(fromDateInputDisplay('')).toBe('');
  });
});

describe('formatCurrency', () => {
  it('formats number with 2 decimal places', () => {
    expect(formatCurrency(4250)).toBe('4,250.00');
  });

  it('formats string input', () => {
    expect(formatCurrency('3000')).toBe('3,000.00');
  });

  it('formats Indian number with lakhs separator', () => {
    expect(formatCurrency('125000.5')).toBe('1,25,000.50');
  });

  it('returns empty string for undefined', () => {
    expect(formatCurrency(undefined)).toBe('');
  });

  it('returns string representation for NaN input', () => {
    expect(formatCurrency('not-a-number')).toBe('not-a-number');
  });
});
