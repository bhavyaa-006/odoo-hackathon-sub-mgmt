export const AuthCard = ({ children, className = '' }) => {
  return (
    <div
      className={`
        w-full max-w-[460px] bg-white rounded-xl border border-[#4B6584]/20
        shadow-elevated p-6 sm:p-8 transition-shadow
        ${className}
      `}
    >
      {children}
    </div>
  );
};

export default AuthCard;
