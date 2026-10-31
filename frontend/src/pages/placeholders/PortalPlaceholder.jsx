import { useNavigate } from 'react-router-dom';
import { LogOut, UserCheck, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../routes/routeConfig';
import BrandLogo from '../../components/ui/BrandLogo';
import Button from '../../components/ui/Button';

export const PortalPlaceholder = ({
  portalTitle,
  roleBadge,
  accentColor = 'navy',
  description,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate(ROUTES.HOME);
  };

  const accentBadgeStyles = {
    teal: 'bg-[#E0F2F1] text-[#00796B] border-[#00796B]/20',
    slateblue: 'bg-[#E3F2FD] text-[#1F4E79] border-[#1F4E79]/20',
    navy: 'bg-[#E3F2FD] text-[#1F4E79] border-[#1F4E79]/20',
  }[accentColor] || 'bg-[#E3F2FD] text-[#1F4E79] border-[#1F4E79]/20';

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="bg-white border-b border-[#4B6584]/20 py-3.5 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo size="default" />
            <span className="hidden sm:inline-block h-4 w-px bg-[#4B6584]/25" />
            <span className="hidden sm:inline-block text-xs font-semibold uppercase tracking-wider text-[#4B6584]">
              {portalTitle}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-[#333333]">{user?.name || 'Authorized User'}</div>
              <div className="text-[11px] text-[#4B6584]">{user?.email}</div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              icon={<LogOut className="w-3.5 h-3.5" />}
              iconPosition="right"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="grow max-w-4xl w-full mx-auto p-4 sm:p-8 flex flex-col justify-center">
        <div className="bg-white rounded-xl border border-[#4B6584]/20 shadow-card p-6 sm:p-10">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-6 pb-6 border-b border-[#4B6584]/15">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${accentBadgeStyles}`}>
                  {roleBadge}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#00796B] bg-[#E0F2F1] px-2.5 py-1 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Authenticated Session
                </span>
              </div>
              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#1F4E79] tracking-tight">
                {portalTitle}
              </h1>
              <p className="text-sm text-[#4B6584] mt-1">
                {description}
              </p>
            </div>
          </div>

          {/* User Profile Summary */}
          <div className="bg-[#F5F5F5] rounded-lg p-5 border border-[#4B6584]/15 mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#333333] mb-3 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-[#00796B]" />
              Verified Account Details
            </h3>
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <dt className="text-[#4B6584] font-medium">Full Name</dt>
                <dd className="font-semibold text-[#333333] mt-0.5">{user?.name || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-[#4B6584] font-medium">Email Address</dt>
                <dd className="font-semibold text-[#333333] mt-0.5">{user?.email}</dd>
              </div>
              <div>
                <dt className="text-[#4B6584] font-medium">Assigned Role</dt>
                <dd className="font-semibold text-[#1F4E79] uppercase tracking-wider mt-0.5">{user?.role}</dd>
              </div>
              {user?.company_name && (
                <div>
                  <dt className="text-[#4B6584] font-medium">Organization</dt>
                  <dd className="font-semibold text-[#333333] mt-0.5">{user.company_name}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="p-4 rounded-lg bg-[#E3F2FD] border border-[#B3D7F5] text-xs text-[#1F4E79] leading-relaxed">
            <p className="font-semibold text-sm mb-1 text-[#1F4E79]">
              Phase 1: Entry Flow & Authentication Complete
            </p>
            <p>
              Your token has been securely verified, authorization boundaries were enforced, and your session is active.
              Subsequent phases will implement the subscription management tables, quotations, billing workflows, and reporting metrics.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PortalPlaceholder;
