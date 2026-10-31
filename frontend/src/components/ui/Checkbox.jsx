import { Check } from 'lucide-react';

export const Checkbox = ({
  id,
  name,
  checked,
  onChange,
  label,
  error,
  disabled = false,
  className = '',
}) => {
  const checkboxId = id || name;

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label
        htmlFor={checkboxId}
        className={`flex items-start gap-2.5 cursor-pointer select-none group ${
          disabled ? 'opacity-60 cursor-not-allowed' : ''
        }`}
      >
        <div className="relative flex items-center justify-center shrink-0 mt-0.5">
          <input
            id={checkboxId}
            name={name}
            type="checkbox"
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            className="sr-only peer"
            aria-invalid={Boolean(error)}
          />
          <div
            className={`
              w-4 h-4 rounded border transition-colors flex items-center justify-center
              peer-focus-visible:ring-2 peer-focus-visible:ring-[#1E88E5] peer-focus-visible:ring-offset-1
              ${
                checked
                  ? 'bg-[#1F4E79] border-[#1F4E79] text-white'
                  : 'bg-white border-[#4B6584]/40 hover:border-[#1F4E79]'
              }
              ${error ? 'border-[#FF6F61]' : ''}
            `}
          >
            {checked && <Check className="w-3 h-3 stroke-[3]" />}
          </div>
        </div>

        <div className="text-xs font-sans text-[#333333] leading-relaxed">
          {label}
        </div>
      </label>

      {error && (
        <p className="text-xs text-[#FF6F61] font-medium pl-6" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default Checkbox;
