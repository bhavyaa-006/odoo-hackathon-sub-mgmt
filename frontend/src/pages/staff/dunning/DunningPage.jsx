import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  RefreshCw,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { dunningService } from '../../../services/dunning.service';
import StaffPageHeader from '../../../components/staff/StaffPageHeader';
import StatCard from '../../../components/staff/StatCard';
import DataTable from '../../../components/staff/DataTable';
import Money from '../../../components/ui/Money';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

export const DunningPage = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchDunning = async () => {
      try {
        setLoading(true);
        const res = await dunningService.getDunningOverview();
        if (isMounted) setData(res);
      } catch (err) {
        console.error('Failed to load dunning overview:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchDunning();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading automated dunning pipeline..." />
      </div>
    );
  }

  const overview = data?.overview || {};
  const cases = data?.cases || [];

  const filteredCases = cases.filter((c) => {
    const term = search.toLowerCase().trim();
    return (
      !term ||
      c.case_number?.toLowerCase().includes(term) ||
      c.customer_name?.toLowerCase().includes(term) ||
      c.customer_company?.toLowerCase().includes(term) ||
      c.invoice_number?.toLowerCase().includes(term)
    );
  });

  const columns = [
    {
      header: 'Case #',
      accessor: (c) => (
        <div className="min-w-0">
          <Link
            to={`/staff/dunning/${c.id}`}
            className="font-bold text-xs text-[#1F4E79] hover:underline block truncate"
          >
            {c.case_number}
          </Link>
          <span className="text-[10px] text-slate-400">
            Invoice: {c.invoice_number}
          </span>
        </div>
      ),
    },
    {
      header: 'Customer',
      accessor: (c) => (
        <div className="min-w-0 text-xs">
          <Link
            to={`/staff/customers/${c.customer_id}`}
            className="font-bold text-[#333333] hover:underline block truncate"
          >
            {c.customer_company || c.customer_name}
          </Link>
          <span className="text-[11px] text-[#4B6584] truncate block">
            {c.customer_name}
          </span>
        </div>
      ),
    },
    {
      header: 'Overdue Amount',
      accessor: (c) => (
        <div className="text-xs font-bold text-rose-600">
          <Money minor={c.outstanding_amount_minor || 0} />
        </div>
      ),
    },
    {
      header: 'Retry Cadence',
      accessor: (c) => (
        <div className="text-xs">
          <span className="font-bold text-[#1F4E79]">
            Attempt {c.retry_count} of {c.max_retries}
          </span>
          <div className="text-[10px] text-[#4B6584]">
            Next: {new Date(c.next_retry_date).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    {
      header: 'Last Error Code',
      accessor: (c) => (
        <div className="text-xs max-w-[200px]">
          <span className="font-mono text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
            {c.attempts?.[c.attempts.length - 1]?.error_code || 'DECLINED'}
          </span>
          <p className="text-[10px] text-[#4B6584] truncate mt-0.5">
            {c.last_failure_reason}
          </p>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (c) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
            c.recovery_status === 'active'
              ? 'bg-amber-100 text-amber-800'
              : c.recovery_status === 'recovered'
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-rose-100 text-rose-800'
          }`}
        >
          {c.recovery_status}
        </span>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      accessor: (c) => (
        <div className="flex items-center justify-end">
          <Link
            to={`/staff/dunning/${c.id}`}
            className="p-1.5 text-[#00796B] hover:bg-[#E0F2F1] rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-bold"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Assist</span>
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <StaffPageHeader
        title="Dunning & Automated Retries"
        subtitle="Manage failed auto-debit payments, schedule retries, monitor churn risk, and compose AI reminder communications."
        breadcrumbs={[
          { label: 'Staff Workspace', link: '/staff' },
          { label: 'Dunning Cases' },
        ]}
      />

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Dunning Cases"
          value={overview.active_dunning_cases || 2}
          subtitle="Under automated retry cycle"
          icon={RefreshCw}
          color="amber"
        />

        <StatCard
          title="Revenue at Risk"
          value={<Money minor={overview.revenue_at_risk_minor || 0} />}
          subtitle="Delinquent recurring ARR"
          icon={AlertTriangle}
          color="rose"
        />

        <StatCard
          title="Recovery Success Rate"
          value={`${overview.recovery_rate_pct || 88.8}%`}
          subtitle="Recovered in retry cadence"
          icon={CheckCircle2}
          color="teal"
          trend="Above 85% SLA"
        />

        <StatCard
          title="Pending Next Retries"
          value={overview.pending_retries || 2}
          subtitle="Scheduled within 48h"
          icon={Clock}
          color="navy"
        />
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center gap-3">
        <Search className="w-4 h-4 text-[#4B6584] shrink-0" />
        <input
          type="text"
          placeholder="Search dunning cases by case number (DUN-...), customer, or invoice..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-xs rounded-xl focus:outline-none font-medium text-[#333333]"
        />
      </div>

      {/* Cases Table */}
      <DataTable
        columns={columns}
        data={filteredCases}
        loading={loading}
        emptyTitle="No dunning cases found"
        emptyDescription="All subscription accounts are current and up to date."
      />
    </div>
  );
};

export default DunningPage;
