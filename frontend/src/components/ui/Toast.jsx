import { useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { ToastContext } from '../../context/ToastContext';

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast = { id, message, type };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    return id;
  }, [removeToast]);

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur),
    info: (msg, dur) => addToast(msg, 'info', dur),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
        aria-live="polite"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            className={`
              pointer-events-auto flex items-start gap-3 p-3.5 rounded-lg border shadow-elevated bg-white
              transition-all duration-200 animate-in fade-in slide-in-from-bottom-2
              ${
                item.type === 'success'
                  ? 'border-[#00796B]/30'
                  : item.type === 'error'
                  ? 'border-[#FF6F61]/40'
                  : 'border-[#1E88E5]/30'
              }
            `}
            role="alert"
          >
            <div className="shrink-0 mt-0.5">
              {item.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-[#00796B]" />
              ) : item.type === 'error' ? (
                <AlertCircle className="w-5 h-5 text-[#FF6F61]" />
              ) : (
                <Info className="w-5 h-5 text-[#1E88E5]" />
              )}
            </div>

            <div className="grow text-xs font-medium text-[#333333] leading-relaxed pt-0.5">
              {item.message}
            </div>

            <button
              onClick={() => removeToast(item.id)}
              className="shrink-0 text-[#4B6584] hover:text-[#333333] p-0.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E88E5]"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
