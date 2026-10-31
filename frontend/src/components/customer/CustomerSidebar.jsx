import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Layers,
  FileSpreadsheet,
  Receipt,
  Bell,
  User,
  LogOut,
} from 'lucide-react';
import BrandLogo from '../ui/BrandLogo';
import { useAuth } from '../../hooks/useAuth';

export const CustomerSidebar = ({ unreadCount = 0 }) => {
  const { user, logout } = useAuth();

  const navItems = [
    {
      to: '/customer',
      end: true,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      to: '/customer/subscriptions',
      label: 'My Subscriptions',
      icon: Layers,
    },
    {
      to: '/customer/quotations',
      label: 'My Quotations',
      icon: FileSpreadsheet,
    },
    {
      to: '/customer/invoices',
      label: 'My Invoices',
      icon: Receipt,
    },
    {
      to: '/customer/notifications',
      label: 'Notifications',
      icon: Bell,
      badge: unreadCount > 0 ? unreadCount : null,
    },
    {
      to: '/customer/profile',
      label: 'Profile',
      icon: User,
    },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white border-r border-[#4B6584]/20 shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="p-6 border-b border-[#4B6584]/15">
        <BrandLogo size="default" />
        <div className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-[#00796B] bg-[#E0F2F1] px-2.5 py-0.5 rounded-full inline-block">
          Customer Portal
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Customer Navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `
                flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold
                transition-colors select-none group
                ${
                  isActive
                    ? 'bg-[#E3F2FD] text-[#1F4E79] shadow-xs'
                    : 'text-[#4B6584] hover:bg-[#F5F5F5] hover:text-[#1F4E79]'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 stroke-[2]" />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#FF6F61] text-white">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Card & Logout */}
      <div className="p-4 border-t border-[#4B6584]/15 bg-[#F5F5F5]/60">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#333333] truncate">
              {user?.name || 'Customer'}
            </p>
            <p className="text-[11px] text-[#4B6584] truncate">
              {user?.email}
            </p>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-[#4B6584] hover:text-[#FF6F61] hover:bg-white rounded-lg border border-[#4B6584]/20 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default CustomerSidebar;
