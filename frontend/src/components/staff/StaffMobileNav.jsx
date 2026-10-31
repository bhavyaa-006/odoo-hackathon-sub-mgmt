import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  X,
  LayoutDashboard,
  Users,
  FileSpreadsheet,
  Layers,
  Receipt,
  FileMinus,
  PlayCircle,
  CreditCard,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  ShieldCheck,
  Bell,
  LogOut,
} from 'lucide-react';
import BrandLogo from '../ui/BrandLogo';
import { useAuth } from '../../hooks/useAuth';

export const StaffMobileNav = ({ isOpen, onClose, unreadCount = 0 }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  // Close drawer on route change
  useEffect(() => {
    if (isOpen) {
      onClose();
    }
  }, [location.pathname, isOpen, onClose]);

  const hasFinance =
    user?.role === 'admin' ||
    user?.role === 'finance' ||
    (Array.isArray(user?.permissions) && user.permissions.includes('finance'));

  const navGroups = [
    {
      group: null,
      items: [
        {
          to: '/staff',
          end: true,
          label: 'Dashboard',
          icon: LayoutDashboard,
        },
      ],
    },
    {
      group: 'SALES',
      items: [
        { to: '/staff/customers', label: 'Customers', icon: Users },
        { to: '/staff/quotations', label: 'Quotations', icon: FileSpreadsheet },
        { to: '/staff/subscriptions', label: 'Subscriptions', icon: Layers },
      ],
    },
    {
      group: 'BILLING',
      items: [
        { to: '/staff/invoices', label: 'Invoices', icon: Receipt },
        { to: '/staff/credit-notes', label: 'Credit Notes', icon: FileMinus },
        { to: '/staff/billing-runs', label: 'Billing Runs', icon: PlayCircle },
      ],
    },
    {
      group: 'COLLECTIONS',
      items: [
        { to: '/staff/payments', label: 'Payments', icon: CreditCard },
        { to: '/staff/overdue', label: 'Overdue Invoices', icon: AlertTriangle },
        { to: '/staff/dunning', label: 'Dunning Cases', icon: RefreshCw },
      ],
    },
    {
      group: 'ANALYTICS & SYSTEM',
      items: [
        ...(hasFinance
          ? [{ to: '/staff/finance', label: 'Finance Dashboard', icon: TrendingUp }]
          : []),
        { to: '/staff/integrity', label: 'Integrity Checks', icon: ShieldCheck },
        {
          to: '/staff/notifications',
          label: 'Notification Outbox',
          icon: Bell,
          badge: unreadCount > 0 ? unreadCount : null,
        },
      ],
    },
  ];

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Staff Navigation Menu"
      className="fixed inset-0 z-50 md:hidden flex"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col shadow-2xl z-10">
        <div className="p-4 border-b border-[#4B6584]/15 flex items-center justify-between">
          <div>
            <BrandLogo size="small" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F4E79] bg-[#E3F2FD] px-2 py-0.5 rounded-full inline-block mt-1">
              Staff Workspace
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#4B6584] hover:text-[#333333] hover:bg-[#F5F5F5] rounded-lg"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-3 overflow-y-auto" aria-label="Mobile Staff Nav">
          {navGroups.map((groupObj, gIdx) => (
            <div key={gIdx} className="space-y-1">
              {groupObj.group && (
                <div className="px-3 pt-2 text-[10px] font-extrabold uppercase tracking-wider text-[#4B6584]/70">
                  {groupObj.group}
                </div>
              )}
              {groupObj.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onClose}
                    className={({ isActive }) => `
                      flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold
                      transition-colors select-none
                      ${
                        isActive
                          ? 'bg-[#E3F2FD] text-[#1F4E79] font-bold'
                          : 'text-[#4B6584] hover:bg-[#F5F5F5] hover:text-[#1F4E79]'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 stroke-[2]" />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#FF6F61] text-white">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-[#4B6584]/15 bg-[#F5F5F5]/60">
          <div className="mb-3">
            <p className="text-xs font-bold text-[#333333] truncate">{user?.name}</p>
            <p className="text-[11px] text-[#4B6584] truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-[#4B6584] hover:text-[#FF6F61] hover:bg-white rounded-lg border border-[#4B6584]/20 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default StaffMobileNav;
