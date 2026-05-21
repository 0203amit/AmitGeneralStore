import { createContext, useContext, useState, useCallback } from 'react';
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

  const addToast = useCallback(({ type = 'info', message, duration = 4000 }) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
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

function ToastItem({ toast, onDismiss }) {
  const Icon = ICONS[toast.type] || ICONS.info;
  const style = STYLES[toast.type] || STYLES.info;

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg transition-all ${style}`}
      role="alert"
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <p className="text-sm">{toast.message}</p>
      <button
        onClick={onDismiss}
        className="ml-auto flex-shrink-0 opacity-60 hover:opacity-100"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
