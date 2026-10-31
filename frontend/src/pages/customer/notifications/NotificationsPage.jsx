import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Mail,
  ArrowRight,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';
import notificationService from '../../../services/notification.service';
import Button from '../../../components/ui/Button';
import EmptyState from '../../../components/ui/EmptyState';
import { CardSkeleton } from '../../../components/ui/Skeleton';
import { formatDateTime, formatRelativeTime } from '../../../utils/formatters';

export const NotificationsPage = () => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const fetchNotifications = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await notificationService.getOutboxNotifications();
      const list = data.messages || (Array.isArray(data) ? data : []);
      setMessages(list);
      const firstUnread = list.find((m) => !m.is_read);
      if (firstUnread) setExpandedId(firstUnread.id);
    } catch (err) {
      setError(err.userMessage || 'Failed to retrieve notification messages.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const data = await notificationService.getOutboxNotifications();
        const list = data.messages || (Array.isArray(data) ? data : []);
        if (isMounted) {
          setMessages(list);
          const firstUnread = list.find((m) => !m.is_read);
          if (firstUnread) setExpandedId(firstUnread.id);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.userMessage || 'Failed to retrieve notification messages.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggleExpand = async (msg) => {
    const isNowExpanded = expandedId !== msg.id;
    setExpandedId(isNowExpanded ? msg.id : null);

    // If opening an unread message, mark as read
    if (isNowExpanded && !msg.is_read) {
      try {
        await notificationService.markAsRead(msg.id);
        setMessages((prev) =>
          prev.map((item) => (item.id === msg.id ? { ...item, is_read: true } : item))
        );
      } catch {
        // Silently continue
      }
    }
  };

  const getBadgeColor = (type) => {
    switch (type) {
      case 'dunning':
        return 'bg-[#FFEBEE] text-[#FF6F61] border-[#FF6F61]/30';
      case 'quotation':
        return 'bg-[#E3F2FD] text-[#1F4E79] border-[#1F4E79]/20';
      case 'invoice':
        return 'bg-[#E0F2F1] text-[#00796B] border-[#00796B]/25';
      default:
        return 'bg-[#F5F5F5] text-[#4B6584] border-[#4B6584]/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-extrabold text-2xl text-[#1F4E79] tracking-tight">
            Notification Outbox
          </h1>
          <p className="text-xs text-[#4B6584] mt-0.5">
            System emails and automated billing notices delivered to your registered address
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchNotifications}
          isLoading={isLoading}
          icon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh
        </Button>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 bg-[#FFEBEE] border border-[#FF6F61]/40 rounded-xl flex items-center justify-between text-xs text-[#333333]">
          <div className="flex items-center gap-2 text-[#FF6F61] font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="danger" size="sm" onClick={fetchNotifications}>
            Retry
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : messages.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="You're all caught up."
          description="There are no email notifications or billing messages in your outbox."
        />
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => {
            const isExpanded = expandedId === msg.id;

            return (
              <div
                key={msg.id}
                className={`
                  bg-white rounded-xl border transition-all duration-150 overflow-hidden shadow-card
                  ${
                    !msg.is_read
                      ? 'border-[#1E88E5]/40 bg-[#E3F2FD]/20'
                      : 'border-[#4B6584]/20 hover:border-[#1F4E79]/40'
                  }
                `}
              >
                {/* Header row */}
                <div
                  onClick={() => handleToggleExpand(msg)}
                  className="p-4 sm:p-5 flex items-start sm:items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`
                        w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 sm:mt-0
                        ${
                          !msg.is_read
                            ? 'bg-[#1E88E5] text-white shadow-xs'
                            : 'bg-[#F5F5F5] text-[#4B6584]'
                        }
                      `}
                    >
                      <Mail className="w-4 h-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getBadgeColor(
                            msg.message_type
                          )}`}
                        >
                          {msg.message_type}
                        </span>
                        {!msg.is_read && (
                          <span className="w-2 h-2 rounded-full bg-[#1E88E5]" title="Unread" />
                        )}
                        <span className="text-xs font-heading font-bold text-[#333333] truncate">
                          {msg.subject}
                        </span>
                      </div>
                      <p className="text-xs text-[#4B6584] truncate max-w-lg">
                        To: {msg.recipient}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-[#4B6584] hidden sm:inline">
                      {formatRelativeTime(msg.created_at)}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-[#4B6584]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#4B6584]" />
                    )}
                  </div>
                </div>

                {/* Expanded Body */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-2 border-t border-[#4B6584]/15 bg-white text-xs space-y-4">
                    <div className="flex items-center justify-between text-[11px] text-[#4B6584] py-1 border-b border-[#4B6584]/10">
                      <span>Delivered at: {formatDateTime(msg.created_at)}</span>
                      <span>Recipient: {msg.recipient}</span>
                    </div>

                    <div className="p-4 bg-[#F5F5F5] rounded-lg font-mono text-xs text-[#333333] whitespace-pre-wrap leading-relaxed border border-[#4B6584]/15">
                      {msg.body}
                    </div>

                    {/* Navigation shortcut to related invoice or quotation */}
                    {msg.related_resource_type && msg.related_resource_id && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-[#4B6584]">
                          Linked Resource:{' '}
                          <strong className="text-[#333333] uppercase">
                            {msg.related_resource_type}
                          </strong>
                        </span>
                        <Link
                          to={
                            msg.related_resource_type === 'invoice'
                              ? `/customer/invoices/${msg.related_resource_id}`
                              : msg.related_resource_type === 'quotation'
                              ? `/customer/quotations/${msg.related_resource_id}`
                              : `/customer/subscriptions/${msg.related_resource_id}`
                          }
                          className="inline-flex items-center gap-1 font-semibold text-xs text-[#1F4E79] hover:underline"
                        >
                          <span>Open {msg.related_resource_type}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
