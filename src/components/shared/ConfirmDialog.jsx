import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import LoadingSpinner from './LoadingSpinner';

/**
 * Reusable confirmation dialog modal with animations, keyboard support,
 * and focus trap.
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
  confirmLabel,
  cancelLabel,
  confirmClassName = 'bg-brand-primary text-white hover:bg-brand-primary/90',
  onConfirm,
  onCancel,
  loading = false,
}) {
  const { t } = useTranslation();
  const resolvedConfirmLabel = confirmLabel || t('common.confirm');
  const resolvedCancelLabel = cancelLabel || t('common.cancel');
  const cancelRef = useRef(null);
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Save and restore focus, auto-focus cancel button on mount
  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    cancelRef.current?.focus();
    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  // Keyboard: Escape to close
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && !loading) {
        onCancel();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, loading]);

  // Focus trap
  useEffect(() => {
    function handleTab(e) {
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fadeIn items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-sm animate-scaleIn rounded-lg bg-white p-6 shadow-xl"
      >
        <h2 id="confirm-dialog-title" className="font-heading text-lg font-semibold text-slate-900">
          {title}
        </h2>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="cursor-pointer rounded-md px-4 py-2 text-sm font-medium text-slate-600 transition-colors duration-200 hover:bg-slate-100 disabled:opacity-50"
          >
            {resolvedCancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex cursor-pointer items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors duration-200 disabled:opacity-50 ${confirmClassName}`}
          >
            {loading && <LoadingSpinner size="sm" />}
            {resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
