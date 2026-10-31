export const Divider = ({ label, className = '' }) => {
  if (!label) {
    return <hr className={`border-t border-[#4B6584]/20 my-4 ${className}`} />;
  }

  return (
    <div className={`relative flex items-center justify-center my-4 ${className}`}>
      <div className="grow border-t border-[#4B6584]/20" />
      <span className="shrink-0 px-3 text-xs font-medium text-[#4B6584] uppercase tracking-wider bg-white">
        {label}
      </span>
      <div className="grow border-t border-[#4B6584]/20" />
    </div>
  );
};

export default Divider;
