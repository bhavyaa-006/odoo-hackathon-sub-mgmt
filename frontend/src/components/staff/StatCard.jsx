export const StatCard = ({
  title,
  value,
  subtext,
  icon: Icon,
  variant = 'default', // 'default' | 'navy' | 'teal' | 'amber' | 'coral'
  trend,
  className = '',
}) => {
  const variantStyles = {
    default: 'bg-white border-[#4B6584]/20 text-[#1F4E79]',
    navy: 'bg-[#1F4E79] text-white border-transparent',
    teal: 'bg-white border-[#00796B]/30 text-[#00796B]',
    amber: 'bg-white border-[#FFC107]/40 text-[#B78103]',
    coral: 'bg-white border-[#FF6F61]/40 text-[#FF6F61]',
  };

  const iconBg = {
    default: 'bg-[#E3F2FD] text-[#1F4E79]',
    navy: 'bg-white/15 text-white',
    teal: 'bg-[#00796B]/10 text-[#00796B]',
    amber: 'bg-[#FFC107]/15 text-[#B78103]',
    coral: 'bg-[#FF6F61]/15 text-[#FF6F61]',
  };

  const isDark = variant === 'navy';

  return (
    <div
      className={`
        rounded-xl border p-5 shadow-card transition-all duration-150 relative overflow-hidden
        ${variantStyles[variant] || variantStyles.default}
        ${className}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-white/80' : 'text-[#4B6584]'}`}>
            {title}
          </p>
          <div className="mt-2 text-2xl font-heading font-extrabold tracking-tight">
            {value}
          </div>
          {subtext && (
            <p className={`text-xs mt-1.5 flex items-center gap-1.5 ${isDark ? 'text-white/70' : 'text-[#4B6584]'}`}>
              {trend && (
                <span className={`font-bold ${trend > 0 ? (isDark ? 'text-[#A8D5BA]' : 'text-[#00796B]') : (isDark ? 'text-[#FFC107]' : 'text-[#FF6F61]')}`}>
                  {trend > 0 ? `+${trend}%` : `${trend}%`}
                </span>
              )}
              <span>{subtext}</span>
            </p>
          )}
        </div>

        {Icon && (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg[variant] || iconBg.default}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
