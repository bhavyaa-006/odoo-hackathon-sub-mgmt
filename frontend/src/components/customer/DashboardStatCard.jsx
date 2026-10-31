import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const DashboardStatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  accent = 'navy', // 'navy' | 'teal' | 'coral' | 'amber'
  linkTo,
}) => {
  const accentStyles = {
    navy: {
      iconBg: 'bg-[#E3F2FD] text-[#1F4E79]',
      topBar: 'bg-[#1F4E79]',
    },
    teal: {
      iconBg: 'bg-[#E0F2F1] text-[#00796B]',
      topBar: 'bg-[#00796B]',
    },
    coral: {
      iconBg: 'bg-[#FFEBEE] text-[#FF6F61]',
      topBar: 'bg-[#FF6F61]',
    },
    amber: {
      iconBg: 'bg-[#FFF9E6] text-[#D39E00]',
      topBar: 'bg-[#FFC107]',
    },
  }[accent] || {
    iconBg: 'bg-[#E3F2FD] text-[#1F4E79]',
    topBar: 'bg-[#1F4E79]',
  };

  const cardContent = (
    <div className="relative bg-white rounded-xl border border-[#4B6584]/20 shadow-card p-5 sm:p-6 overflow-hidden transition-all duration-150 hover:shadow-elevated group">
      <div className={`absolute top-0 left-0 right-0 h-1 ${accentStyles.topBar}`} />

      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="text-xs font-semibold text-[#4B6584] uppercase tracking-wider">
          {title}
        </span>
        <div className={`p-2 rounded-lg shrink-0 ${accentStyles.iconBg}`}>
          {Icon && <Icon className="w-5 h-5 stroke-[2]" />}
        </div>
      </div>

      <div className="text-2xl sm:text-3xl font-heading font-extrabold text-[#333333] tracking-tight mb-1">
        {value}
      </div>

      <div className="flex items-center justify-between text-xs text-[#4B6584] mt-2">
        <span>{subtitle}</span>
        {linkTo && (
          <span className="inline-flex items-center gap-0.5 text-[#1E88E5] font-semibold group-hover:translate-x-0.5 transition-transform">
            View <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
    </div>
  );

  if (linkTo) {
    return <Link to={linkTo} className="block">{cardContent}</Link>;
  }

  return cardContent;
};

export default DashboardStatCard;
