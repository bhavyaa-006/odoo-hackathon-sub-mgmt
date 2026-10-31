import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  X,
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

export const CustomerMobileNav = ({ isOpen, onClose, unreadCount = 0 }) => {
  const { user, logout } = useAuth();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 md:hidden flex" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#1F4E79]/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer surface */}
      <div className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col shadow-2xl z-10 animate-in slide-in-from-left duration-200">
        <div className="p-4 border-b border-[#4B6584]/20 flex items-center justify-between">
          <BrandLogo size="small" />
          <button
            onClick={onClose}
            className="p-1.5 text-[#4B6584] hover:text-[#333333] rounded-lg focus:outline-none"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) => `
                  flex items-center justify-between px-3.5 py-3 rounded-lg text-sm font-semibold
                  transition-colors select-none
                  ${
                    isActive
                      ? 'bg-[#E3F2FD] text-[#1F4E79]'
                      : 'text-[#4B6584] hover:bg-[#F5F5F5] hover:text-[#1F4E79]'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-[#FF6F61] text-white">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#4B6584]/15 bg-[#F5F5F5]/60">
          <div className="mb-3">
            <p className="text-sm font-bold text-[#333333] truncate">
              {user?.name || 'Customer'}
            </p>
            <p className="text-xs text-[#4B6584] truncate">
              {user?.email}
            </p>
          </div>
          <button
            onClick={() => {
              onClose();
              logout();
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-[#FF6F61] hover:bg-white rounded-lg border border-[#4B6584]/20 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerMobileNav;
