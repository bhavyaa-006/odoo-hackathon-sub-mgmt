import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Bell, User, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export const CustomerTopbar = ({ onOpenMobileMenu, unreadCount = 0 }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine page title based on path
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/customer') return 'Customer Dashboard';
    if (path.startsWith('/customer/subscriptions')) return 'My Subscriptions';
    if (path.startsWith('/customer/quotations')) return 'My Quotations';
    if (path.startsWith('/customer/invoices')) return 'My Invoices';
    if (path.startsWith('/customer/notifications')) return 'Notifications & Outbox';
    if (path.startsWith('/customer/profile')) return 'Customer Profile';
    return 'Customer Portal';
  };

  const getInitials = (name) => {
    if (!name) return 'CU';
    const parts = name.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-[#4B6584]/20 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      {/* Left: Mobile hamburger + Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 text-[#4B6584] hover:text-[#1F4E79] hover:bg-[#F5F5F5] rounded-lg focus:outline-none"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h1 className="font-heading font-bold text-lg sm:text-xl text-[#1F4E79] tracking-tight">
          {getPageTitle()}
        </h1>
      </div>

      {/* Right: Notification shortcut + User Dropdown */}
      <div className="flex items-center gap-3 sm:gap-4">

        {/* Notifications Shortcut */}
        <Link
          to="/customer/notifications"
          className="relative p-2 rounded-lg text-[#4B6584] hover:text-[#1F4E79] hover:bg-[#E3F2FD] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E88E5]"
          aria-label={`View notifications (${unreadCount} unread)`}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#FF6F61] rounded-full ring-2 ring-white" />
          )}
        </Link>

        {/* User Profile Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowProfileMenu((prev) => !prev)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#F5F5F5] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E88E5]"
            aria-expanded={showProfileMenu}
            aria-haspopup="true"
          >
            <div className="w-8 h-8 rounded-full bg-[#1F4E79] text-white flex items-center justify-center font-bold text-xs select-none shadow-xs">
              {getInitials(user?.name)}
            </div>
            <span className="hidden sm:inline text-xs font-semibold text-[#333333]">
              {user?.name || 'Customer'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#4B6584]" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-[#4B6584]/20 shadow-elevated py-1.5 z-30 animate-in fade-in zoom-in-95">
              <div className="px-3.5 py-2 border-b border-[#4B6584]/15">
                <p className="text-xs font-bold text-[#333333] truncate">
                  {user?.name}
                </p>
                <p className="text-[11px] text-[#4B6584] truncate">
                  {user?.email}
                </p>
              </div>

              <Link
                to="/customer/profile"
                onClick={() => setShowProfileMenu(false)}
                className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-[#333333] hover:bg-[#E3F2FD] hover:text-[#1F4E79] transition-colors"
              >
                <User className="w-4 h-4 text-[#4B6584]" />
                <span>My Profile</span>
              </Link>

              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  logout();
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-[#FF6F61] hover:bg-[#FFEBEE] transition-colors text-left"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default CustomerTopbar;
