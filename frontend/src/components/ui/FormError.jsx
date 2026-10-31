import { AlertCircle, CheckCircle2 } from 'lucide-react';

export const FormError = ({ message, className = '' }) => {
  if (!message) return null;

  return (
    <div
      role="alert"
      className={`flex items-start gap-2.5 p-3.5 rounded-lg bg-[#FFEBEE] border border-[#FF6F61]/40 text-xs text-[#333333] ${className}`}
    >
      <AlertCircle className="w-4 h-4 text-[#FF6F61] shrink-0 mt-0.5" aria-hidden="true" />
      <div className="font-medium leading-relaxed">{message}</div>
    </div>
  );
};

export const FormSuccess = ({ message, className = '' }) => {
  if (!message) return null;

  return (
    <div
      role="status"
      className={`flex items-start gap-2.5 p-3.5 rounded-lg bg-[#E0F2F1] border border-[#00796B]/30 text-xs text-[#005B51] ${className}`}
    >
      <CheckCircle2 className="w-4 h-4 text-[#00796B] shrink-0 mt-0.5" aria-hidden="true" />
      <div className="font-medium leading-relaxed">{message}</div>
    </div>
  );
};

export default FormError;
