import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext(null);

/**
 * Hook to show toast notifications from any component.
 * @returns {{ addToast: (opts: {type?: 'success'|'error'|'info', message: string, duration?: number}) => number, removeToast: (id: number) => void }}
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}

/**
 * Provider that manages a stack of toast notifications.
 * Renders a fixed container in the bottom-right corner.
 * Wrap your app with this provider to enable toast notifications.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ type = 'info', message, duration = 5000 }) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message, duration, dismissing: false }]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, dismissing: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
        aria-live="assertive"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const STYLES = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

const PROGRESS_COLORS = {
  success: 'bg-green-400',
  error: 'bg-red-400',
  info: 'bg-blue-400',
};

function ToastItem({ toast, onDismiss }) {
  const Icon = ICONS[toast.type] || ICONS.info;
  const style = STYLES[toast.type] || STYLES.info;
  const progressColor = PROGRESS_COLORS[toast.type] || PROGRESS_COLORS.info;
  const timerRef = useRef(null);

  useEffect(() => {
    if (toast.duration > 0) {
      timerRef.current = setTimeout(onDismiss, toast.duration);
    }
    return () => clearTimeout(timerRef.current);
  }, [toast.duration, onDismiss]);

  return (
    <div
      className={`overflow-hidden rounded-lg border shadow-lg ${
        toast.dismissing ? 'animate-toastOut' : 'animate-toastIn'
      } ${style}`}
      role="alert"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <Icon className="h-5 w-5 flex-shrink-0" />
        <p className="text-sm">{toast.message}</p>
        <button
          onClick={onDismiss}
          className="ml-auto flex-shrink-0 cursor-pointer opacity-60 transition-opacity duration-200 hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {toast.duration > 0 && (
        <div className="h-0.5 w-full bg-black/5">
          <div
            className={`h-full ${progressColor}`}
            style={{
              animation: `shrinkWidth ${toast.duration}ms linear forwards`,
            }}
          />
          <style>{`
            @keyframes shrinkWidth {
              from { width: 100%; }
              to { width: 0%; }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
