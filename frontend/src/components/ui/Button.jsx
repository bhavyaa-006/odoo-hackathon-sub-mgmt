import LoadingSpinner from './LoadingSpinner';

export const Button = ({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  fullWidth = false,
  icon = null,
  iconPosition = 'left',
  onClick,
  className = '',
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-sans font-semibold rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed select-none';

  const variants = {
    primary:
      'bg-[#1F4E79] text-white hover:bg-[#163A5C] active:bg-[#112C46] focus-visible:ring-[#1F4E79] shadow-sm',
    secondary:
      'bg-[#00796B] text-white hover:bg-[#005B51] active:bg-[#00473F] focus-visible:ring-[#00796B] shadow-sm',
    outline:
      'border border-[#4B6584]/30 bg-white text-[#1F4E79] hover:bg-[#F5F5F5] hover:border-[#1F4E79] active:bg-[#E3F2FD] focus-visible:ring-[#1E88E5]',
    ghost:
      'bg-transparent text-[#4B6584] hover:bg-[#E3F2FD] hover:text-[#1F4E79] active:bg-[#BBDEFB] focus-visible:ring-[#1E88E5]',
    light:
      'bg-[#E3F2FD] text-[#1F4E79] hover:bg-[#BBDEFB] active:bg-[#90CAF9] focus-visible:ring-[#1E88E5]',
    danger:
      'bg-[#FF6F61] text-white hover:bg-[#E05345] active:bg-[#C93B2E] focus-visible:ring-[#FF6F61] shadow-sm',
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 h-8 gap-1.5',
    md: 'text-sm px-4 py-2.5 h-11 gap-2',
    lg: 'text-base px-6 py-3 h-12 gap-2.5',
  };

  const isButtonDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      disabled={isButtonDisabled}
      onClick={onClick}
      className={`
        ${baseStyles}
        ${variants[variant] || variants.primary}
        ${sizes[size] || sizes.md}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {isLoading ? (
        <>
          <LoadingSpinner size={size === 'sm' ? 'sm' : 'md'} />
          <span>Processing...</span>
        </>
      ) : (
        <>
          {icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>}
          {children}
          {icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
        </>
      )}
    </button>
  );
};

export default Button;
