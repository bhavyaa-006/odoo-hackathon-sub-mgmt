import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Filter,
  Eye,
} from 'lucide-react';
import { subscriptionService } from '../../../services/subscription.service';
import StaffPageHeader from '../../../components/staff/StaffPageHeader';
import DataTable from '../../../components/staff/DataTable';
import StatusBadge from '../../../components/ui/StatusBadge';
import Money from '../../../components/ui/Money';

export const SubscriptionsPage = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    let isMounted = true;
    const fetchSubscriptions = async () => {
      try {
        setLoading(true);
        const res = await subscriptionService.getStaffSubscriptions();
        if (isMounted) {
          setSubscriptions(res.subscriptions || []);
        }
      } catch (err) {
        console.error('Failed to load subscriptions:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchSubscriptions();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredSubscriptions = subscriptions.filter((s) => {
    const term = search.toLowerCase().trim();
    const matchesSearch =
      !term ||
      s.subscription_number?.toLowerCase().includes(term) ||
      s.customer_name?.toLowerCase().includes(term) ||
      s.customer_company?.toLowerCase().includes(term) ||
      s.plan_name?.toLowerCase().includes(term);

    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const columns = [
    {
      header: 'Subscription #',
      accessor: (s) => (
        <div className="min-w-0">
          <Link
            to={`/staff/subscriptions/${s.id}`}
            className="font-bold text-xs text-[#1F4E79] hover:underline block truncate"
          >
            {s.subscription_number}
          </Link>
          <div className="text-[11px] text-[#4B6584] truncate">{s.plan_name}</div>
        </div>
      ),
    },
    {
      header: 'Customer',
      accessor: (s) => (
        <div className="min-w-0 text-xs">
          <Link
            to={`/staff/customers/${s.customer_id}`}
            className="font-bold text-[#333333] hover:underline block truncate"
          >
            {s.customer_company || s.customer_name}
          </Link>
          <span className="text-[11px] text-[#4B6584] truncate block">
            {s.customer_name}
          </span>
        </div>
      ),
    },
    {
      header: 'Cycle',
      accessor: (s) => (
        <div className="text-xs capitalize font-medium text-[#333333]">
          {s.billing_interval || 'Monthly'}
        </div>
      ),
    },
    {
      header: 'Recurring Price',
      accessor: (s) => (
        <div className="text-xs font-bold text-[#333333]">
          <Money minor={s.unit_price_minor || 0} />
          <span className="text-[10px] text-[#4B6584] font-normal block">
            / {s.billing_interval || 'month'}
          </span>
        </div>
      ),
    },
    {
      header: 'Next Billing',
      accessor: (s) => (
        <div className="text-xs">
          <span className="font-semibold text-[#333333]">
            {s.next_billing_date || s.current_period_end || 'N/A'}
          </span>
          <div className="text-[10px] text-slate-400">
            Started: {s.start_date || 'N/A'}
          </div>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (s) => <StatusBadge status={s.status} />,
    },
    {
      header: 'Actions',
      className: 'text-right',
      accessor: (s) => (
        <div className="flex items-center justify-end">
          <Link
            to={`/staff/subscriptions/${s.id}`}
            className="p-1.5 text-[#1F4E79] hover:bg-[#E3F2FD] rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-bold"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Inspect</span>
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <StaffPageHeader
        title="Subscription Lifecycle"
        subtitle="Supervise active subscriber accounts, control lifecycle state transitions, execute renewals, and manage plan tiers."
        breadcrumbs={[
          { label: 'Staff Workspace', link: '/staff' },
          { label: 'Subscriptions' },
        ]}
      />

      {/* Filter & Search */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-[#4B6584] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search subscriptions by ID (SUB-...), customer name, company, or plan..."
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
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="confirmed">Confirmed</option>
            <option value="paused">Paused</option>
            <option value="past_due">Past Due</option>
            <option value="closed">Closed / Cancelled</option>
          </select>
        </div>
      </div>

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={filteredSubscriptions}
        loading={loading}
        emptyTitle="No subscriptions found"
        emptyDescription={
          search
            ? `No subscription matches "${search}".`
            : 'No active or archived subscriptions in the workspace.'
        }
      />
    </div>
  );
};

export default SubscriptionsPage;
