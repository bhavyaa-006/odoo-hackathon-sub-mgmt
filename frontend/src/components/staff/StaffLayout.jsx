import { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import StaffSidebar from './StaffSidebar';
import StaffTopbar from './StaffTopbar';
import StaffMobileNav from './StaffMobileNav';
import TimeMachineModal from './TimeMachine';
import AskBrightloop from './AskBrightloop';
import { staffService } from '../../services/staff.service';
import notificationService from '../../services/notification.service';

export const StaffLayout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [timeMachineOpen, setTimeMachineOpen] = useState(false);
  const [askBrightloopOpen, setAskBrightloopOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [timeMachineDate, setTimeMachineDate] = useState(() => staffService.getTimeMachineDate());

  const refreshTimeMachine = useCallback(() => {
    setTimeMachineDate(staffService.getTimeMachineDate());
  }, []);

  const handleDateChange = (newDate) => {
    setTimeMachineDate(newDate);
  };

  useEffect(() => {
    let isMounted = true;
    const fetchUnread = async () => {
      try {
        const data = await notificationService.getOutboxNotifications();
        if (isMounted && data) {
          setUnreadCount(data.unread_count || 0);
        }
      } catch {
        // silently ignore in background
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
      <StaffSidebar unreadCount={unreadCount} />

      {/* Mobile Drawer */}
      <StaffMobileNav
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        unreadCount={unreadCount}
      />

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0">
        <StaffTopbar
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          unreadCount={unreadCount}
          timeMachineDate={timeMachineDate}
          onOpenTimeMachine={() => setTimeMachineOpen(true)}
          onOpenAskBrightloop={() => setAskBrightloopOpen(true)}
        />

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet
            context={{
              timeMachineDate,
              refreshTimeMachine,
              openTimeMachine: () => setTimeMachineOpen(true),
              openAskBrightloop: () => setAskBrightloopOpen(true),
            }}
          />
        </main>
      </div>

      {/* Modals */}
      <TimeMachineModal
        isOpen={timeMachineOpen}
        onClose={() => setTimeMachineOpen(false)}
        currentDate={timeMachineDate}
        onDateChange={handleDateChange}
      />

      <AskBrightloop
        isOpen={askBrightloopOpen}
        onClose={() => setAskBrightloopOpen(false)}
      />
    </div>
  );
};

export default StaffLayout;
