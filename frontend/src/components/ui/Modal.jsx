import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export const Modal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-md',
}) => {
  const modalRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#1F4E79]/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Surface */}
      <div
        ref={modalRef}
        className={`
          relative w-full ${maxWidth} bg-white rounded-xl border border-[#4B6584]/20
          shadow-elevated p-6 z-10 transition-all transform animate-in fade-in zoom-in-95
        `}
      >
        <div className="flex items-start justify-between pb-3 mb-4 border-b border-[#4B6584]/15">
          <div>
            <h2 id="modal-title" className="font-heading font-bold text-xl text-[#1F4E79]">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs font-sans text-[#4B6584] mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#4B6584] hover:text-[#333333] hover:bg-[#F5F5F5] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E88E5]"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>{children}</div>
      </div>
    </div>
  );
};

export default Modal;
