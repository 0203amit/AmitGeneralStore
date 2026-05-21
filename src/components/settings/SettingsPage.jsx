/**
 * SettingsPage at /settings.
 * Archive management, sign-out, app info, and direct links to
 * the owner's Drive folder and Google Sheet.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { saveAs } from 'file-saver';
import {
  Archive,
  RotateCcw,
  LogOut,
  ExternalLink,
  Info,
  FileSpreadsheet,
  FolderOpen,
  HardDriveDownload,
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import { getAllRecords, getSpreadsheetId, restoreRecord } from '../../services/sheetsService';
import { downloadFullBackup, buildBackupFilename } from '../../services/recordService';
import { getFolderIds } from '../../services/driveService';
import { buildPageTitle, BUSINESS_NAME } from '../../config/branding';
import { formatTimestamp, formatCurrency, formatDisplayDate } from '../../utils/dateHelpers';
import { useToast } from '../shared/Toast';
import ConfirmDialog from '../shared/ConfirmDialog';
import LoadingSpinner from '../shared/LoadingSpinner';

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { addToast } = useToast();
  const [archivedRecords, setArchivedRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [restoringId, setRestoringId] = useState(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [backupGenerating, setBackupGenerating] = useState(false);
  const [backupProgress, setBackupProgress] = useState(null);

  document.title = buildPageTitle('settings');

  const fetchArchived = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const records = await getAllRecords();
      const archived = records
        .filter((r) => r.status === 'archived')
        .sort((a, b) => {
          const dateA = a.archived_at ? new Date(a.archived_at).getTime() : 0;
          const dateB = b.archived_at ? new Date(b.archived_at).getTime() : 0;
          return dateB - dateA;
        });
      setArchivedRecords(archived);
    } catch (err) {
      setError(err.message || 'Failed to load archived records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArchived();
  }, [fetchArchived]);

  async function handleRestore(recordId) {
    setRestoringId(recordId);
    try {
      await restoreRecord(recordId);
      setArchivedRecords((prev) => prev.filter((r) => r.record_id !== recordId));
      addToast({ type: 'success', message: 'Record restored successfully' });
    } catch (err) {
      addToast({ type: 'error', message: err.message || 'Failed to restore record' });
    } finally {
      setRestoringId(null);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
    } catch {
      addToast({ type: 'error', message: 'Sign-out failed' });
    }
  }

  async function handleDownloadBackup() {
    setBackupGenerating(true);
    setBackupProgress(null);
    try {
      const blob = await downloadFullBackup((progress) => setBackupProgress(progress));
      saveAs(blob, buildBackupFilename());
      addToast({ type: 'success', message: 'Full backup downloaded successfully' });
    } catch (err) {
      console.error('Backup download failed:', err);
      addToast({ type: 'error', message: 'Failed to generate backup' });
    } finally {
      setBackupGenerating(false);
      setBackupProgress(null);
    }
  }

  const folderIds = getFolderIds();
  const spreadsheetId = getSpreadsheetId();
  const driveFolderUrl = folderIds?.rootId
    ? `https://drive.google.com/drive/folders/${folderIds.rootId}`
    : null;
  const sheetUrl = spreadsheetId
    ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
    : null;

  return (
    <div className="p-4 sm:p-8">
      <h1 className="mb-6 text-xl font-bold text-slate-900 sm:text-2xl">Settings</h1>

      <div className="space-y-6">
        {/* Archive Management */}
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Archive className="h-5 w-5 text-slate-500" />
              Archived Records
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Records hidden from the main History view. Restore them to make them visible again.
            </p>
          </div>
          <div className="px-4 py-4 sm:px-6">
            {loading ? (
              <LoadingSpinner size="md" className="py-8" />
            ) : error ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-4 text-center">
                <p className="text-sm text-red-700">{error}</p>
                <button
                  onClick={fetchArchived}
                  className="mt-2 text-sm font-medium text-brand-primary hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : archivedRecords.length === 0 ? (
              <div className="py-8 text-center">
                <Archive className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm text-slate-500">No archived records</p>
              </div>
            ) : (
              <div className="space-y-3">
                {archivedRecords.map((record) => (
                  <div
                    key={record.record_id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/history/${record.record_id}`}
                        className="text-sm font-medium text-slate-900 hover:text-brand-primary hover:underline"
                      >
                        {record.trader_name || 'Unknown Trader'}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Invoice {record.invoice_number || '\u2014'} &middot;{' '}
                        {formatDisplayDate(record.bill_date)} &middot;{' '}
                        {record.bill_amount ? `\u20B9${formatCurrency(record.bill_amount)}` : '\u2014'}
                      </p>
                      {record.archived_at && (
                        <p className="mt-0.5 text-xs text-slate-400">
                          Archived {formatTimestamp(record.archived_at)}
                          {record.archived_reason ? ` \u2014 ${record.archived_reason}` : ''}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRestore(record.record_id)}
                      disabled={restoringId === record.record_id}
                      className="ml-3 flex flex-shrink-0 items-center gap-1.5 rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 transition hover:bg-green-100 disabled:opacity-50"
                    >
                      {restoringId === record.record_id ? (
                        <>
                          <LoadingSpinner size="sm" />
                          Restoring…
                        </>
                      ) : (
                        <>
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restore
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Data & Backup */}
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <HardDriveDownload className="h-5 w-5 text-slate-500" />
              Data & Backup
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Download a full backup of all records and images.
            </p>
          </div>
          <div className="px-4 py-4 sm:px-6">
            <button
              onClick={handleDownloadBackup}
              disabled={backupGenerating}
              className="flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-primary/90 disabled:opacity-50"
            >
              {backupGenerating ? (
                <>
                  <LoadingSpinner size="sm" />
                  Generating backup…
                </>
              ) : (
                <>
                  <HardDriveDownload className="h-4 w-4" />
                  Download full backup
                </>
              )}
            </button>

            {backupProgress && backupProgress.total > 0 && (
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                  <span>Downloading images…</span>
                  <span>{backupProgress.current} / {backupProgress.total}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-brand-primary transition-all duration-300"
                    style={{ width: `${Math.round((backupProgress.current / backupProgress.total) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            <p className="mt-4 text-xs text-slate-400">
              Your backup includes a CSV of all records (including archived) and all bill/payment
              images. We recommend downloading a backup periodically for safekeeping.
            </p>
          </div>
        </section>

        {/* Account */}
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
            <h2 className="text-base font-semibold text-slate-900">Account</h2>
          </div>
          <div className="px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {user?.picture ? (
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="h-10 w-10 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary text-sm font-medium text-white">
                    {(user?.name || '?')[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                  <p className="text-xs text-slate-500">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={() => setShowSignOutConfirm(true)}
                className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </section>

        {/* App Info */}
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Info className="h-5 w-5 text-slate-500" />
              App Info
            </h2>
          </div>
          <div className="px-4 py-4 sm:px-6">
            <dl className="space-y-3">
              <div className="flex items-center justify-between">
                <dt className="text-sm text-slate-500">App</dt>
                <dd className="text-sm font-medium text-slate-900">{BUSINESS_NAME}</dd>
              </div>
            </dl>
            {(driveFolderUrl || sheetUrl) && (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:gap-3">
                {driveFolderUrl && (
                  <a
                    href={driveFolderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <FolderOpen className="h-4 w-4" />
                    Open Drive Folder
                    <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                  </a>
                )}
                {sheetUrl && (
                  <a
                    href={sheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Open Google Sheet
                    <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                  </a>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Sign-out confirmation dialog */}
      {showSignOutConfirm && (
        <ConfirmDialog
          title="Sign out?"
          message="You will need to sign in again to access your receipts."
          confirmLabel="Sign out"
          confirmClassName="bg-red-600 text-white hover:bg-red-700"
          onConfirm={() => {
            setShowSignOutConfirm(false);
            handleSignOut();
          }}
          onCancel={() => setShowSignOutConfirm(false)}
        />
      )}
    </div>
  );
}
