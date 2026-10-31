import { NavLink } from 'react-router-dom';
import {
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

export const StaffSidebar = ({ unreadCount = 0 }) => {
  const { user, logout } = useAuth();

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
        {
          to: '/staff/customers',
          label: 'Customers',
          icon: Users,
        },
        {
          to: '/staff/quotations',
          label: 'Quotations',
          icon: FileSpreadsheet,
        },
        {
          to: '/staff/subscriptions',
          label: 'Subscriptions',
          icon: Layers,
        },
      ],
    },
    {
      group: 'BILLING',
      items: [
        {
          to: '/staff/invoices',
          label: 'Invoices',
          icon: Receipt,
        },
        {
          to: '/staff/credit-notes',
          label: 'Credit Notes',
          icon: FileMinus,
        },
        {
          to: '/staff/billing-runs',
          label: 'Billing Runs',
          icon: PlayCircle,
        },
      ],
    },
    {
      group: 'COLLECTIONS',
      items: [
        {
          to: '/staff/payments',
          label: 'Payments',
          icon: CreditCard,
        },
        {
          to: '/staff/overdue',
          label: 'Overdue Invoices',
          icon: AlertTriangle,
        },
        {
          to: '/staff/dunning',
          label: 'Dunning Cases',
          icon: RefreshCw,
        },
      ],
    },
    {
      group: 'ANALYTICS & SYSTEM',
      items: [
        ...(hasFinance
          ? [
              {
                to: '/staff/finance',
                label: 'Finance Dashboard',
                icon: TrendingUp,
              },
            ]
          : []),
        {
          to: '/staff/integrity',
          label: 'Integrity Checks',
          icon: ShieldCheck,
        },
        {
          to: '/staff/notifications',
          label: 'Notification Outbox',
          icon: Bell,
          badge: unreadCount > 0 ? unreadCount : null,
        },
      ],
    },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white border-r border-[#4B6584]/20 shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="p-5 border-b border-[#4B6584]/15">
        <BrandLogo size="default" />
        <div className="mt-2.5 flex items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#1F4E79] bg-[#E3F2FD] px-2.5 py-0.5 rounded-full inline-block">
            Staff Workspace
          </span>
          <span className="text-[10px] font-semibold text-[#00796B] bg-[#E0F2F1] px-2 py-0.5 rounded-full">
            Ops Console
          </span>
        </div>
      </div>

      {/* Navigation Scrollable Area */}
      <nav
        className="flex-1 px-3 py-3 space-y-4 overflow-y-auto max-h-[calc(100vh-140px)]"
        aria-label="Staff Navigation"
      >
        {navGroups.map((groupObj, gIdx) => (
          <div key={gIdx} className="space-y-1">
            {groupObj.group && (
              <div className="px-3 pt-2 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-[#4B6584]/70">
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
                  className={({ isActive }) => `
                    flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold
                    transition-all select-none group
                    ${
                      isActive
                        ? 'bg-[#E3F2FD] text-[#1F4E79] shadow-xs font-bold'
                        : 'text-[#4B6584] hover:bg-[#F5F5F5] hover:text-[#1F4E79]'
                    }
                  `}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 shrink-0 stroke-[2]" />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#FF6F61] text-white shrink-0">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User Card & Logout */}
      <div className="p-3.5 border-t border-[#4B6584]/15 bg-[#F5F5F5]/60 mt-auto">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#333333] truncate">
              {user?.name || 'Staff User'}
            </p>
            <p className="text-[10px] text-[#4B6584] truncate">
              {user?.role === 'admin'
                ? 'System Administrator'
                : user?.role === 'finance'
                ? 'Finance Officer'
                : 'Operations Specialist'}
            </p>
          </div>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 uppercase">
            {user?.role || 'staff'}
          </span>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#4B6584] hover:text-[#FF6F61] hover:bg-white rounded-lg border border-[#4B6584]/20 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default StaffSidebar;
