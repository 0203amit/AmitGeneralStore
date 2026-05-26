import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Upload } from 'lucide-react';
import { buildPageTitle } from '../../config/branding';
import { getAllRecords } from '../../services/sheetsService';
import LoadingSpinner from '../shared/LoadingSpinner';
import MonthlySummary from './MonthlySummary';
import PaymentModeChart from './PaymentModeChart';

/**
 * Dashboard page showing at-a-glance monthly spending, record counts,
 * payment mode breakdown, and top traders.
 * Fetches records directly via sheetsService.getAllRecords().
 */
export default function DashboardPage() {
  const { t } = useTranslation();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  document.title = buildPageTitle(t('navbar.dashboard'));

  useEffect(() => {
    let cancelled = false;

    async function fetchRecords() {
      try {
        setLoading(true);
        setError(null);
        const allRecords = await getAllRecords();
        if (!cancelled) {
          setRecords(allRecords.filter((r) => r.status === 'active'));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load records');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchRecords();
    return () => {
      cancelled = true;
    };
  }, []);

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
          <p className="text-sm font-medium text-red-800">
            {t('dashboard.failedToLoad')}
          </p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="p-4 sm:p-8">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          {t('dashboard.title')}
        </h1>
        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-10 text-center">
          <Upload className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-600">
            {t('dashboard.noRecordsYet')}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {t('dashboard.noRecordsHint')}
          </p>
          <Link
            to="/upload"
            className="mt-4 inline-block rounded-lg bg-brand-primary px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-primary/90"
          >
            {t('dashboard.uploadReceipt')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
        {t('dashboard.title')}
      </h1>

      <div className="mt-6">
        <MonthlySummary records={records} />
      </div>

      <div className="mt-6">
        <PaymentModeChart records={records} />
      </div>
    </div>
  );
}
