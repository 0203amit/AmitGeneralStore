/**
 * Hook for fetching, searching, filtering, sorting, and paginating records.
 * Operates entirely in-memory for <50ms search performance.
 * Uses lodash debounce (300ms) for search input.
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { debounce } from 'lodash';
import { getAllRecords } from '../services/sheetsService';
import { parseDate } from '../utils/dateHelpers';

const SEARCH_FIELDS = [
  'trader_name',
  'invoice_number',
  'utr_number',
  'payer_name',
  'payee_name',
  'trader_address',
  'upi_transaction_id',
  'google_transaction_id',
];

/**
 * @param {Object} [initialFilters] - Optional initial filter state
 * @returns {{
 *   records: Object[],
 *   allRecords: Object[],
 *   loading: boolean,
 *   error: string|null,
 *   searchQuery: string,
 *   setSearchQuery: (q: string) => void,
 *   filters: Object,
 *   setFilters: (f: Object) => void,
 *   sortBy: string,
 *   sortDir: 'asc'|'desc',
 *   setSortBy: (field: string) => void,
 *   toggleSortDir: () => void,
 *   page: number,
 *   setPage: (p: number) => void,
 *   pageSize: number,
 *   setPageSize: (s: number) => void,
 *   totalFiltered: number,
 *   totalPages: number,
 *   refreshRecords: () => Promise<void>,
 * }}
 */
export default function useRecords(initialFilters = {}) {
  const [allRecords, setAllRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search state
  const [searchQuery, setSearchQueryImmediate] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Filter state
  const [filters, setFilters] = useState({
    dateStart: null,
    dateEnd: null,
    paymentModes: [],
    amountMin: null,
    amountMax: null,
    traders: [],
    status: 'active',
    ...initialFilters,
  });

  // Sort state
  const [sortBy, setSortBy] = useState('bill_date');
  const [sortDir, setSortDir] = useState('desc');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Debounced search
  const debouncedSetSearch = useRef(
    debounce((q) => setDebouncedSearch(q), 300)
  ).current;

  const setSearchQuery = useCallback(
    (q) => {
      setSearchQueryImmediate(q);
      debouncedSetSearch(q);
    },
    [debouncedSetSearch]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => debouncedSetSearch.cancel();
  }, [debouncedSetSearch]);

  // Fetch records
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const records = await getAllRecords();
      setAllRecords(records);
    } catch (err) {
      setError(err.message || 'Failed to load records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Reset page when filters, search, or pageSize change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters, pageSize]);

  // Filtered + searched + sorted records
  const { paginatedRecords, filteredRecords, totalFiltered, totalPages } = useMemo(() => {
    let result = allRecords;

    // Status filter
    if (filters.status && filters.status !== 'all') {
      result = result.filter((r) => r.status === filters.status);
    }

    // Text search (case-insensitive substring across multiple fields)
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter((r) =>
        SEARCH_FIELDS.some((field) =>
          (r[field] || '').toLowerCase().includes(query)
        )
      );
    }

    // Date range filter
    if (filters.dateStart || filters.dateEnd) {
      result = result.filter((r) => {
        const recordDate = parseDate(r.bill_date);
        if (!recordDate) return false;
        if (filters.dateStart) {
          const start = parseDate(filters.dateStart);
          if (start && recordDate < start) return false;
        }
        if (filters.dateEnd) {
          const end = parseDate(filters.dateEnd);
          if (end && recordDate > end) return false;
        }
        return true;
      });
    }

    // Payment mode filter
    if (filters.paymentModes && filters.paymentModes.length > 0) {
      result = result.filter((r) =>
        filters.paymentModes.includes(r.payment_mode)
      );
    }

    // Amount range filter
    if (filters.amountMin !== null && filters.amountMin !== '') {
      const min = parseFloat(filters.amountMin);
      if (!isNaN(min)) {
        result = result.filter((r) => parseFloat(r.bill_amount) >= min);
      }
    }
    if (filters.amountMax !== null && filters.amountMax !== '') {
      const max = parseFloat(filters.amountMax);
      if (!isNaN(max)) {
        result = result.filter((r) => parseFloat(r.bill_amount) <= max);
      }
    }

    // Trader filter
    if (filters.traders && filters.traders.length > 0) {
      const tradersLower = filters.traders.map((t) => t.toLowerCase());
      result = result.filter((r) =>
        tradersLower.includes((r.trader_name || '').toLowerCase())
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let valA, valB;

      switch (sortBy) {
        case 'bill_date':
        case 'payment_date':
        case 'created_at': {
          const dateA = sortBy === 'created_at' ? new Date(a[sortBy]) : parseDate(a[sortBy]);
          const dateB = sortBy === 'created_at' ? new Date(b[sortBy]) : parseDate(b[sortBy]);
          valA = dateA ? dateA.getTime() : 0;
          valB = dateB ? dateB.getTime() : 0;
          break;
        }
        case 'bill_amount':
        case 'paid_amount':
          valA = parseFloat(a[sortBy]) || 0;
          valB = parseFloat(b[sortBy]) || 0;
          break;
        case 'trader_name':
        default:
          valA = (a[sortBy] || '').toLowerCase();
          valB = (b[sortBy] || '').toLowerCase();
          break;
      }

      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    const filtered = result;
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const startIdx = (page - 1) * pageSize;
    const paginated = filtered.slice(startIdx, startIdx + pageSize);

    return { paginatedRecords: paginated, filteredRecords: filtered, totalFiltered: total, totalPages: pages };
  }, [allRecords, debouncedSearch, filters, sortBy, sortDir, page, pageSize]);

  const toggleSortDir = useCallback(() => {
    setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }, []);

  // Get unique trader names for filter dropdown
  const uniqueTraders = useMemo(() => {
    const traders = new Set();
    allRecords.forEach((r) => {
      if (r.trader_name && r.status === 'active') traders.add(r.trader_name);
    });
    return [...traders].sort();
  }, [allRecords]);

  return {
    records: paginatedRecords,
    filteredRecords,
    allRecords,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    sortBy,
    sortDir,
    setSortBy,
    toggleSortDir,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalFiltered,
    totalPages,
    refreshRecords: fetchRecords,
    uniqueTraders,
  };
}
