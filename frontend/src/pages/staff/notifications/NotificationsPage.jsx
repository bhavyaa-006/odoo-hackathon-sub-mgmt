import { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  Search,
  Filter,
  Eye,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { notificationService } from '../../../services/notification.service';
import StaffPageHeader from '../../../components/staff/StaffPageHeader';
import DataTable from '../../../components/staff/DataTable';

export const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [activeItem, setActiveItem] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [notice, setNotice] = useState(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await notificationService.getStaffNotifications();
      setNotifications(res.notifications || []);
    } catch (err) {
      console.error('Failed to load outbox notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const res = await notificationService.getStaffNotifications();
        if (isMounted) setNotifications(res.notifications || []);
      } catch (err) {
        console.error('Failed to load outbox notifications:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    run();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleRetry = async (id) => {
    try {
      setRetrying(true);
      const res = await notificationService.retryNotification(id);
      setNotice({
        type: 'success',
        message: res.message || 'Notification queued for immediate redelivery.',
      });
      fetchNotifications();
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      setNotice({
        type: 'error',
        message: err.message || 'Failed to retry notification delivery.',
      });
    } finally {
      setRetrying(false);
    }
  };

  const filteredNotifications = notifications.filter((item) => {
    const term = search.toLowerCase().trim();
    const matchesSearch =
      !term ||
      item.recipient?.toLowerCase().includes(term) ||
      item.recipient_name?.toLowerCase().includes(term) ||
      item.customer_company?.toLowerCase().includes(term) ||
      item.subject?.toLowerCase().includes(term) ||
      item.related_resource_number?.toLowerCase().includes(term);

    const matchesStatus = statusFilter === 'all' || item.delivery_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const columns = [
    {
      header: 'Recipient',
      accessor: (n) => (
        <div className="min-w-0">
          <span className="font-bold text-xs text-[#333333] block truncate">
            {n.recipient_name}
          </span>
          <span className="text-[11px] text-[#4B6584] truncate block">
            {n.recipient}
          </span>
          <span className="text-[10px] text-slate-400 block truncate">
            {n.customer_company}
          </span>
        </div>
      ),
    },
    {
      header: 'Subject & Category',
      accessor: (n) => (
        <div className="min-w-0 max-w-xs">
          <button
            type="button"
            onClick={() => {
              setActiveItem(n);
              setInspectModalOpen(true);
            }}
            className="font-bold text-xs text-[#1F4E79] hover:underline text-left block truncate cursor-pointer"
          >
            {n.subject}
          </button>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-[#E3F2FD] text-[#1F4E79]">
              {n.message_type}
            </span>
            {n.related_resource_number && (
              <span className="text-[10px] font-mono text-[#4B6584]">
                Ref: {n.related_resource_number}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      header: 'Dispatched',
      accessor: (n) => (
        <div className="text-xs">
          <span className="text-[#333333] font-medium">
            {new Date(n.created_at).toLocaleDateString()}
          </span>
          <div className="text-[10px] text-[#4B6584]">
            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (n) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
            n.delivery_status === 'delivered'
              ? 'bg-emerald-100 text-emerald-800'
              : n.delivery_status === 'queued'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-rose-100 text-rose-800'
          }`}
        >
          {n.delivery_status}
        </span>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      accessor: (n) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => {
              setActiveItem(n);
              setInspectModalOpen(true);
            }}
            className="p-1.5 text-[#1F4E79] hover:bg-[#E3F2FD] rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
            title="Inspect email payload"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Inspect</span>
          </button>

          {n.delivery_status === 'failed' && (
            <button
              type="button"
              disabled={retrying}
              onClick={() => handleRetry(n.id)}
              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
              title="Retry delivery"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <StaffPageHeader
        title="Global Notification Outbox"
        subtitle="Monitor transactional invoice deliveries, dunning notices, customer proposal emails, and system dispatch logs."
        breadcrumbs={[
          { label: 'Staff Workspace', link: '/staff' },
          { label: 'Notifications Outbox' },
        ]}
      />

      {notice && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
            notice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{notice.message}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-[#4B6584] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search outbox by recipient, email, subject, or invoice number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-[#4B6584] shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] bg-white font-medium text-[#333333]"
          >
            <option value="all">All Delivery Statuses</option>
            <option value="delivered">Delivered</option>
            <option value="queued">Queued</option>
            <option value="failed">Failed Delivery</option>
          </select>
        </div>
      </div>

      {/* Outbox Table */}
      <DataTable
        columns={columns}
        data={filteredNotifications}
        loading={loading}
        emptyTitle="No outbox notifications found"
        emptyDescription="No automated customer emails or notices logged in this view."
      />

      {/* Inspect Email Modal */}
      {inspectModalOpen && activeItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#1F4E79]" />
                <h3 className="text-sm font-bold font-heading text-[#1F4E79]">
                  Outbox Message Payload
                </h3>
              </div>
              <button
                onClick={() => setInspectModalOpen(false)}
                className="text-[#4B6584] hover:text-[#333333]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-[#4B6584]">Recipient</span>
                <span className="font-bold text-[#333333]">
                  {activeItem.recipient_name} &lt;{activeItem.recipient}&gt;
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-[#4B6584]">Customer Company</span>
                <span className="font-semibold text-[#333333]">
                  {activeItem.customer_company}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-[#4B6584]">Subject</span>
                <span className="font-bold text-[#1F4E79]">{activeItem.subject}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#4B6584]">Delivery Status</span>
                <span className="font-bold uppercase text-emerald-700">
                  {activeItem.delivery_status} (Attempts: {activeItem.attempts || 1})
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className="text-[10px] font-bold text-[#4B6584] uppercase block mb-1">
                Dispatched Body Content
              </span>
              <p className="text-[#333333] whitespace-pre-line leading-relaxed font-sans font-normal">
                {activeItem.body}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setInspectModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-white bg-[#1F4E79] hover:bg-[#163a5c] rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
