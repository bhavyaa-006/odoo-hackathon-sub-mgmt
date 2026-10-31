import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import CustomerSidebar from './CustomerSidebar';
import CustomerTopbar from './CustomerTopbar';
import CustomerMobileNav from './CustomerMobileNav';
import notificationService from '../../services/notification.service';

export const CustomerLayout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const fetchUnread = async () => {
      try {
        const data = await notificationService.getOutboxNotifications();
        if (isMounted && data) {
          setUnreadCount(data.unread_count || 0);
        }
      } catch {
        // Silently swallow in layout background
      }
    };
    fetchUnread();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex font-sans antialiased text-[#333333]">
      {/* Desktop Sidebar */}
      <CustomerSidebar unreadCount={unreadCount} />

      {/* Mobile Drawer */}
      <CustomerMobileNav
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        unreadCount={unreadCount}
      />

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        <CustomerTopbar
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          unreadCount={unreadCount}
        />

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet context={{ refreshUnreadCount: () => {} }} />
        </main>
      </div>
    </div>
  );
};

export default CustomerLayout;
