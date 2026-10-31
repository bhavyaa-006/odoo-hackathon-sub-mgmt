import { Link } from 'react-router-dom';
import { Check, ArrowRight, UserPlus } from 'lucide-react';
import Button from './Button';

export const PortalCard = ({
  title,
  tagline,
  description,
  features = [],
  icon: Icon,
  loginPath,
  loginLabel = 'Sign in',
  registerPath = null,
  registerLabel = 'Create account',
  accent = 'navy', // 'navy' | 'teal' | 'slate'
}) => {
  const accentStyles = {
    teal: {
      badge: 'bg-[#E0F2F1] text-[#00796B] border-[#00796B]/20',
      iconBg: 'bg-[#E0F2F1] text-[#00796B]',
      topBar: 'bg-[#00796B]',
      buttonVariant: 'secondary',
      focusRing: 'focus-visible:ring-[#00796B]',
    },
    slate: {
      badge: 'bg-[#E3F2FD] text-[#1F4E79] border-[#1F4E79]/20',
      iconBg: 'bg-[#E3F2FD] text-[#1F4E79]',
      topBar: 'bg-[#4B6584]',
      buttonVariant: 'primary',
      focusRing: 'focus-visible:ring-[#4B6584]',
    },
    navy: {
      badge: 'bg-[#E3F2FD] text-[#1F4E79] border-[#1F4E79]/20',
      iconBg: 'bg-[#E3F2FD] text-[#1F4E79]',
      topBar: 'bg-[#1F4E79]',
      buttonVariant: 'primary',
      focusRing: 'focus-visible:ring-[#1F4E79]',
    },
  }[accent] || {
    badge: 'bg-[#E3F2FD] text-[#1F4E79] border-[#1F4E79]/20',
    iconBg: 'bg-[#E3F2FD] text-[#1F4E79]',
    topBar: 'bg-[#1F4E79]',
    buttonVariant: 'primary',
    focusRing: 'focus-visible:ring-[#1F4E79]',
  };

  return (
    <div
      className="group relative flex flex-col h-full bg-white rounded-xl border border-[#4B6584]/20 shadow-card hover:shadow-elevated transition-all duration-200 overflow-hidden"
    >
      {/* Top subtle portal accent line */}
      <div className={`h-1.5 w-full ${accentStyles.topBar}`} />

      <div className="p-6 sm:p-7 flex flex-col h-full">
        {/* Header with Icon and Portal Badge */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div
            className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${accentStyles.iconBg}`}
          >
            {Icon && <Icon className="w-6 h-6 stroke-[2]" />}
          </div>
          {tagline && (
            <span
              className={`text-[11px] font-semibold tracking-wider uppercase px-2.5 py-1 rounded-full border ${accentStyles.badge}`}
            >
              {tagline}
            </span>
          )}
        </div>

        {/* Card Title & Description */}
        <h3 className="font-heading font-bold text-xl text-[#333333] mb-2 tracking-tight group-hover:text-[#1F4E79] transition-colors">
          {title}
        </h3>
        <p className="text-sm font-sans text-[#4B6584] leading-relaxed mb-6">
          {description}
        </p>

        {/* Features Checklist */}
        <div className="mb-6 grow">
          <p className="text-xs font-semibold text-[#333333] uppercase tracking-wider mb-3">
            Key capabilities
          </p>
          <ul className="space-y-2.5" role="list">
            {features.map((feature, idx) => (
              <li key={idx} className="flex items-center gap-2.5 text-xs text-[#333333]">
                <span className="w-4 h-4 rounded-full bg-[#E0F2F1] text-[#00796B] flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </span>
                <span className="font-medium">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-[#4B6584]/15 flex flex-col gap-2.5 mt-auto">
          <Link to={loginPath} className="w-full">
            <Button
              variant={accentStyles.buttonVariant}
              fullWidth
              icon={<ArrowRight className="w-4 h-4" />}
              iconPosition="right"
            >
              {loginLabel}
            </Button>
          </Link>

          {registerPath ? (
            <Link to={registerPath} className="w-full">
              <Button
                variant="outline"
                fullWidth
                icon={<UserPlus className="w-4 h-4" />}
                iconPosition="left"
              >
                {registerLabel}
              </Button>
            </Link>
          ) : (
            <div className="h-11 flex items-center justify-center text-xs text-[#4B6584] select-none italic">
              Access provisioned by Administrator
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PortalCard;
