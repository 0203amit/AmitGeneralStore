/**
 * HistoryPage integrating FilterBar and RecordsTable.
 * Syncs filter/search/sort/pagination state to URL query parameters
 * for shareable/bookmarkable views.
 */
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { FileDown, Download, X } from 'lucide-react';
import { buildPageTitle } from '../../config/branding';
import { generateBulkProofPacketPDF } from '../../services/recordService';
import { getAllRecords } from '../../services/sheetsService';
import { generateCsvString, buildCsvFilename } from '../../utils/csvExporter';
import { useToast } from '../shared/Toast';
import ConfirmDialog from '../shared/ConfirmDialog';
import useRecords from '../../hooks/useRecords';
import FilterBar from './FilterBar';
import RecordsTable from './RecordsTable';
import LoadingSpinner from '../shared/LoadingSpinner';

/**
 * Parse URL search params into filter state.
 */
function parseUrlFilters(searchParams) {
  const filters = {};

  if (searchParams.has('dateStart')) filters.dateStart = searchParams.get('dateStart');
  if (searchParams.has('dateEnd')) filters.dateEnd = searchParams.get('dateEnd');

  const modes = searchParams.get('modes');
  if (modes) filters.paymentModes = modes.split(',');

  if (searchParams.has('amountMin')) filters.amountMin = searchParams.get('amountMin');
  if (searchParams.has('amountMax')) filters.amountMax = searchParams.get('amountMax');

  const traders = searchParams.get('traders');
  if (traders) filters.traders = traders.split(',');

  if (searchParams.has('status')) filters.status = searchParams.get('status');

  return filters;
}

/**
 * Serialize filter state to URL search params.
 */
function buildUrlParams(searchQuery, filters, sortBy, sortDir, page, pageSize) {
  const params = new URLSearchParams();

  if (searchQuery) params.set('q', searchQuery);
  if (filters.dateStart) params.set('dateStart', filters.dateStart);
  if (filters.dateEnd) params.set('dateEnd', filters.dateEnd);
  if (filters.paymentModes?.length) params.set('modes', filters.paymentModes.join(','));
  if (filters.amountMin) params.set('amountMin', filters.amountMin);
  if (filters.amountMax) params.set('amountMax', filters.amountMax);
  if (filters.traders?.length) params.set('traders', filters.traders.join(','));
  if (filters.status && filters.status !== 'active') params.set('status', filters.status);
  if (sortBy !== 'bill_date') params.set('sort', sortBy);
  if (sortDir !== 'desc') params.set('dir', sortDir);
  if (page > 1) params.set('page', String(page));
  if (pageSize !== 25) params.set('size', String(pageSize));

  return params;
}

export default function HistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToast } = useToast();
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [csvExporting, setCsvExporting] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [showBulkExportConfirm, setShowBulkExportConfirm] = useState(false);

  document.title = buildPageTitle('history');

  // Initialize hook with URL params
  const initialFilters = parseUrlFilters(searchParams);
  const {
    records,
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
    refreshRecords,
    uniqueTraders,
  } = useRecords(initialFilters);

  // Initialize search from URL
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearchQuery(q);

    const sort = searchParams.get('sort');
    if (sort) setSortBy(sort);

    const dir = searchParams.get('dir');
    if (dir === 'asc') toggleSortDir();

    const urlPage = searchParams.get('page');
    if (urlPage) setPage(Number(urlPage));

    const urlSize = searchParams.get('size');
    if (urlSize) setPageSize(Number(urlSize));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync state → URL (debounced via the search query debounce in useRecords)
  useEffect(() => {
    const params = buildUrlParams(searchQuery, filters, sortBy, sortDir, page, pageSize);
    setSearchParams(params, { replace: true });
  }, [searchQuery, filters, sortBy, sortDir, page, pageSize, setSearchParams]);

  const handleSortChange = useCallback(
    (field) => {
      if (field === sortBy) {
        toggleSortDir();
      } else {
        setSortBy(field);
      }
    },
    [sortBy, setSortBy, toggleSortDir]
  );

  // Clear selection when filters, search, or sort change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [searchQuery, filters, sortBy, sortDir]);

  function handleToggleSelect(recordId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) {
        next.delete(recordId);
      } else {
        next.add(recordId);
      }
      return next;
    });
  }

  function handleToggleSelectAll() {
    if (selectedIds.size === records.length && records.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map((r) => r.record_id)));
    }
  }

  async function handleBulkExportProof() {
    if (selectedIds.size === 0) return;

    const selectedRecords = allRecords.filter((r) => selectedIds.has(r.record_id));
    if (selectedRecords.length === 0) return;

    setBulkGenerating(true);
    try {
      const blob = await generateBulkProofPacketPDF(selectedRecords);
      const filename = `bulk_proof_${selectedRecords.length}_records_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      saveAs(blob, filename);
      addToast({ type: 'success', message: `Proof packet for ${selectedRecords.length} record${selectedRecords.length !== 1 ? 's' : ''} downloaded` });
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Bulk proof generation failed:', err);
      addToast({ type: 'error', message: 'Failed to generate bulk proof packet' });
    } finally {
      setBulkGenerating(false);
    }
  }

  async function handleExportCsv() {
    setCsvExporting(true);
    try {
      const exportRecords = includeArchived
        ? await getAllRecords()
        : filteredRecords;
      const csvString = generateCsvString(exportRecords);
      const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8' });
      saveAs(blob, buildCsvFilename());
      addToast({
        type: 'success',
        message: `Exported ${exportRecords.length} record${exportRecords.length !== 1 ? 's' : ''} to CSV`,
      });
    } catch (err) {
      console.error('CSV export failed:', err);
      addToast({ type: 'error', message: 'Failed to export CSV' });
    } finally {
      setCsvExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={refreshRecords}
            className="mt-3 text-sm font-medium text-brand-primary hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">History</h1>
          <p className="mt-1 text-sm text-slate-500">
            {totalFiltered} record{totalFiltered !== 1 ? 's' : ''} found
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
            />
            Include archived
          </label>
          <button
            onClick={handleExportCsv}
            disabled={csvExporting}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {csvExporting ? (
              <>
                <LoadingSpinner size="sm" />
                Exporting…
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Export CSV
              </>
            )}
          </button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-brand-primary/20 bg-brand-primary/5 px-4 py-3">
          <p className="text-sm font-medium text-brand-primary">
            {selectedIds.size} record{selectedIds.size !== 1 ? 's' : ''} selected
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowBulkExportConfirm(true)}
              disabled={bulkGenerating}
              className="flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-primary/90 disabled:opacity-50"
            >
              {bulkGenerating ? (
                <>
                  <LoadingSpinner size="sm" />
                  Generating…
                </>
              ) : (
                <>
                  <FileDown className="h-4 w-4" />
                  Export selected as proof
                </>
              )}
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="mb-4">
        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filters={filters}
          onFiltersChange={setFilters}
          uniqueTraders={uniqueTraders}
        />
      </div>

      <RecordsTable
        records={records}
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={handleSortChange}
        page={page}
        pageSize={pageSize}
        totalFiltered={totalFiltered}
        totalPages={totalPages}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onToggleSelectAll={handleToggleSelectAll}
      />

      {showBulkExportConfirm && (
        <ConfirmDialog
          title="Export proof packets?"
          message={`Generate a combined proof PDF for ${selectedIds.size} selected record${selectedIds.size !== 1 ? 's' : ''}? This may take a moment.`}
          confirmLabel="Export"
          onConfirm={() => {
            setShowBulkExportConfirm(false);
            handleBulkExportProof();
          }}
          onCancel={() => setShowBulkExportConfirm(false)}
        />
      )}
    </div>
  );
}
