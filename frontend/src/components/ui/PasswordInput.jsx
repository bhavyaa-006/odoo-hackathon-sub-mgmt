import { useState, forwardRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import Input from './Input';

export const PasswordInput = forwardRef(
  ({ id, name, label = 'Password', value, onChange, error, helperText, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    const toggleVisibility = () => {
      setShowPassword((prev) => !prev);
    };

    const toggleButton = (
      <button
        type="button"
        onClick={toggleVisibility}
        className="p-1 text-[#4B6584] hover:text-[#1F4E79] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E88E5] rounded transition-colors"
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        tabIndex={0}
      >
        {showPassword ? (
          <EyeOff className="w-4 h-4" aria-hidden="true" />
        ) : (
          <Eye className="w-4 h-4" aria-hidden="true" />
        )}
      </button>
    );

    return (
      <Input
        ref={ref}
        id={id}
        name={name}
        label={label}
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        error={error}
        helperText={helperText}
        rightIcon={toggleButton}
        autoComplete={props.autoComplete || 'current-password'}
        {...props}
      />
    );
  }
);

PasswordInput.displayName = 'PasswordInput';

export default PasswordInput;
