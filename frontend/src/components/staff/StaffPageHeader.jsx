import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export const StaffPageHeader = ({
  title,
  subtitle,
  breadcrumbs = [],
  actions,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#4B6584]/15">
      <div>
        {breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1.5 text-xs text-[#4B6584] mb-1.5" aria-label="Breadcrumb">
            <Link to="/staff" className="hover:text-[#1F4E79] transition-colors">
              Staff Workspace
            </Link>
            {breadcrumbs.map((crumb, idx) => (
              <span key={idx} className="flex items-center gap-1.5">
                <ChevronRight className="w-3.5 h-3.5 text-[#4B6584]/60" />
                {crumb.link ? (
                  <Link to={crumb.link} className="hover:text-[#1F4E79] transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="font-semibold text-[#1F4E79]">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="font-heading font-extrabold text-2xl text-[#1F4E79] tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs sm:text-sm text-[#4B6584] mt-0.5">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
};

export default StaffPageHeader;
