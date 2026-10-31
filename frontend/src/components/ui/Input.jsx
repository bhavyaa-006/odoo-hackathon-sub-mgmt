import { forwardRef } from 'react';

export const Input = forwardRef(
  (
    {
      id,
      name,
      label,
      type = 'text',
      placeholder,
      value,
      onChange,
      error,
      helperText,
      disabled = false,
      required = false,
      leftIcon = null,
      rightIcon = null,
      autoComplete,
      className = '',
      inputClassName = '',
      ...props
    },
    ref
  ) => {
    const inputId = id || name;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText ? `${inputId}-helper` : undefined;

    return (
      <div className={`w-full flex flex-col gap-1.5 ${className}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-[#333333] tracking-wide"
          >
            {label}
            {required && <span className="text-[#FF6F61] ml-0.5">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-[#4B6584]">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            name={name}
            type={type}
            value={value}
            onChange={onChange}
            disabled={disabled}
            placeholder={placeholder}
            autoComplete={autoComplete}
            required={required}
            aria-invalid={Boolean(error)}
            aria-describedby={[errorId, helperId].filter(Boolean).join(' ') || undefined}
            className={`
              w-full h-11 px-3.5 rounded-lg border bg-white font-sans text-sm text-[#333333] placeholder:text-[#4B6584]/60
              transition-colors duration-150
              focus:outline-none focus:ring-2 focus:ring-[#1E88E5]/30
              disabled:bg-[#F5F5F5] disabled:cursor-not-allowed disabled:text-[#4B6584]
              ${leftIcon ? 'pl-10' : ''}
              ${rightIcon ? 'pr-10' : ''}
              ${
                error
                  ? 'border-[#FF6F61] focus:border-[#FF6F61] focus:ring-[#FF6F61]/25'
                  : 'border-[#4B6584]/30 focus:border-[#1F4E79]'
              }
              ${inputClassName}
            `}
            {...props}
          />

          {rightIcon && (
            <div className="absolute right-3 flex items-center">
              {rightIcon}
            </div>
          )}
        </div>

        {error ? (
          <p id={errorId} className="text-xs text-[#FF6F61] font-medium flex items-center gap-1 mt-0.5" role="alert">
            <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span>{error}</span>
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-xs text-[#4B6584] mt-0.5">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
