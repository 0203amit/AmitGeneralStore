import LoadingSpinner from './LoadingSpinner';

/**
 * Reusable confirmation dialog modal.
 * @param {{
 *   title: string,
 *   message: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   confirmClassName?: string,
 *   onConfirm: () => void,
 *   onCancel: () => void,
 *   loading?: boolean,
 * }} props
 */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmClassName = 'bg-brand-primary text-white hover:bg-brand-primary/90',
  onConfirm,
  onCancel,
  loading = false,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${confirmClassName}`}
          >
            {loading && <LoadingSpinner size="sm" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
