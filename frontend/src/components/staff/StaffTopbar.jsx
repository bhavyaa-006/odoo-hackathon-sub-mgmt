import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Menu,
  Bell,
  Calendar,
  Sparkles,
  LogOut,
  ChevronDown,
  Shield,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import LatencyBadge from './LatencyBadge';

export const StaffTopbar = ({
  onOpenMobileMenu,
  unreadCount = 0,
  timeMachineDate,
  onOpenTimeMachine,
  onOpenAskBrightloop,
}) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/staff') return 'Staff Operations Dashboard';
    if (path.startsWith('/staff/customers')) return 'Customer Directory & Accounts';
    if (path.startsWith('/staff/quotations')) return 'Quotations & Proposals';
    if (path.startsWith('/staff/subscriptions')) return 'Subscription Lifecycle';
    if (path.startsWith('/staff/invoices')) return 'Invoices & Billing';
    if (path.startsWith('/staff/credit-notes')) return 'Credit Notes & Adjustments';
    if (path.startsWith('/staff/billing-runs')) return 'Automated Billing Runs';
    if (path.startsWith('/staff/payments')) return 'Payments & Collections';
    if (path.startsWith('/staff/overdue')) return 'Overdue Receivables & Aging';
    if (path.startsWith('/staff/dunning')) return 'Dunning Cases & Automated Retries';
    if (path.startsWith('/staff/finance')) return 'Executive Finance Dashboard';
    if (path.startsWith('/staff/integrity')) return 'Ledger & State Invariant Integrity';
    if (path.startsWith('/staff/notifications')) return 'Global Notification Outbox';
    return 'Staff Workspace';
  };

  const getInitials = (name) => {
    if (!name) return 'ST';
    const parts = name.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-[#4B6584]/20 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      {/* Left: Mobile hamburger + Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 text-[#4B6584] hover:text-[#1F4E79] hover:bg-[#F5F5F5] rounded-lg focus:outline-none"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h1 className="font-heading font-bold text-base sm:text-lg text-[#1F4E79] tracking-tight truncate">
          {getPageTitle()}
        </h1>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Ask Brightloop trigger button */}
        <button
          onClick={onOpenAskBrightloop}
          className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 hover:border-[#00796B] hover:bg-[#E0F2F1]/30 text-xs font-semibold text-[#4B6584] hover:text-[#00796B] transition-all cursor-pointer shadow-xs"
          title="Open Command Palette (⌘K / Ctrl+K)"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#00796B]" />
          <span className="hidden sm:inline">Ask Brightloop</span>
          <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] font-mono font-bold bg-[#F5F5F5] text-slate-500 rounded border border-slate-200">
            ⌘K
          </kbd>
        </button>

        {/* Time Machine Trigger Button */}
        <button
          onClick={onOpenTimeMachine}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100/80 border border-amber-300 text-amber-900 text-xs font-bold transition-all cursor-pointer shadow-xs"
          title="Adjust simulated operations clock"
        >
          <Calendar className="w-3.5 h-3.5 text-amber-700" />
          <span className="hidden sm:inline">{timeMachineDate || '2026-10-31'}</span>
          <span className="sm:hidden text-[10px]">Clock</span>
        </button>

        {/* Latency Pill */}
        <LatencyBadge />

        {/* Outbox Notifications Link */}
        <Link
          to="/staff/notifications"
          className="relative p-2 text-[#4B6584] hover:text-[#1F4E79] hover:bg-[#F5F5F5] rounded-xl transition-colors"
          aria-label="Notification Outbox"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#FF6F61] ring-2 ring-white" />
          )}
        </Link>

        {/* Staff Profile Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowProfileMenu((prev) => !prev)}
            className="flex items-center gap-2 p-1 pl-2 hover:bg-[#F5F5F5] rounded-xl transition-colors cursor-pointer"
            aria-label="Staff user menu"
          >
            <div className="w-8 h-8 rounded-full bg-[#1F4E79] text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {getInitials(user?.name)}
            </div>
            <div className="hidden lg:block text-left text-xs">
              <p className="font-bold text-[#333333] leading-none">{user?.name || 'Staff'}</p>
              <p className="text-[10px] text-[#4B6584] mt-0.5 capitalize">{user?.role || 'staff'}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#4B6584]" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-30 animate-in fade-in">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="text-xs font-bold text-[#333333]">{user?.name}</p>
                <p className="text-[11px] text-[#4B6584] truncate">{user?.email}</p>
                <div className="mt-1 flex items-center gap-1 text-[10px] text-[#00796B] font-semibold">
                  <Shield className="w-3 h-3" />
                  <span>Role: {user?.role}</span>
                </div>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onOpenTimeMachine();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-[#333333] hover:bg-[#F5F5F5] transition-colors"
                >
                  <Calendar className="w-4 h-4 text-amber-600" />
                  <span>Simulated Time Machine</span>
                </button>

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onOpenAskBrightloop();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-[#333333] hover:bg-[#F5F5F5] transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-[#00796B]" />
                  <span>Ask Brightloop AI</span>
                </button>
              </div>

              <div className="border-t border-slate-100 pt-1">
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default StaffTopbar;
