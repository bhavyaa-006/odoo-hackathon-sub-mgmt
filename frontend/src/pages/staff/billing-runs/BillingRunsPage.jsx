import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Play,
  Search,
  CheckCircle2,
  AlertCircle,
  Eye,
  FileCheck,
} from 'lucide-react';
import { billingService } from '../../../services/billing.service';
import StaffPageHeader from '../../../components/staff/StaffPageHeader';
import DataTable from '../../../components/staff/DataTable';
import Money from '../../../components/ui/Money';

export const BillingRunsPage = () => {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState(null);

  const fetchRuns = useCallback(async () => {
    try {
      setLoading(true);
      const res = await billingService.getBillingRuns();
      setRuns(res.billing_runs || []);
    } catch (err) {
      console.error('Failed to load billing runs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const runFetch = async () => {
      try {
        setLoading(true);
        const res = await billingService.getBillingRuns();
        if (isMounted) setRuns(res.billing_runs || []);
      } catch (err) {
        console.error('Failed to load billing runs:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    runFetch();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleDryRun = async () => {
    try {
      setActionLoading(true);
      const res = await billingService.dryRunBillingRun({
        billing_date: new Date().toISOString().split('T')[0],
      });
      setNotice({
        type: 'success',
        message: res.message || 'Dry run simulation executed with zero errors!',
      });
      fetchRuns();
      setTimeout(() => setNotice(null), 5000);
    } catch (err) {
      setNotice({
        type: 'error',
        message: err.message || 'Dry run failed validation invariants.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCommitRun = async () => {
    try {
      setActionLoading(true);
      const res = await billingService.commitBillingRun({
        billing_date: new Date().toISOString().split('T')[0],
      });
      setNotice({
        type: 'success',
        message: res.message || 'Billing run committed and invoices issued!',
      });
      fetchRuns();
      setTimeout(() => setNotice(null), 5000);
    } catch (err) {
      setNotice({
        type: 'error',
        message: err.message || 'Failed to commit billing run.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const filteredRuns = runs.filter((r) => {
    const term = search.toLowerCase().trim();
    return (
      !term ||
      r.run_number?.toLowerCase().includes(term) ||
      r.summary?.toLowerCase().includes(term) ||
      r.executed_by?.toLowerCase().includes(term)
    );
  });

  const columns = [
    {
      header: 'Run Number',
      accessor: (r) => (
        <div className="min-w-0">
          <Link
            to={`/staff/billing-runs/${r.id}`}
            className="font-bold text-xs text-[#1F4E79] hover:underline block truncate"
          >
            {r.run_number}
          </Link>
          <span className="text-[10px] text-slate-400">
            Billing Period: {r.billing_period}
          </span>
        </div>
      ),
    },
    {
      header: 'Execution Mode',
      accessor: (r) => (
        <div className="text-xs">
          <span className="font-semibold text-[#333333] capitalize">
            {r.execution_type?.replace('_', ' ') || 'Batch'}
          </span>
          <div className="text-[10px] text-[#4B6584]">By: {r.executed_by}</div>
        </div>
      ),
    },
    {
      header: 'Invoiced / Processed',
      accessor: (r) => (
        <div className="text-xs">
          <span className="font-bold text-[#1F4E79]">
            {r.invoices_generated || 0} / {r.total_subscriptions_processed || 0}
          </span>
          <div className="text-[10px] text-[#4B6584]">
            {r.skipped_subscriptions || 0} skipped
          </div>
        </div>
      ),
    },
    {
      header: 'Failed Items',
      accessor: (r) => (
        <div className="text-xs">
          {(r.failed_items || 0) > 0 ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
              {r.failed_items} Failed
            </span>
          ) : (
            <span className="text-emerald-700 font-semibold text-[11px] flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 0 Failures
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Total Invoiced',
      accessor: (r) => (
        <div className="text-xs font-bold text-[#333333]">
          <Money minor={r.total_amount_minor || 0} />
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (r) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
            r.status === 'committed'
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          {r.status}
        </span>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      accessor: (r) => (
        <div className="flex items-center justify-end">
          <Link
            to={`/staff/billing-runs/${r.id}`}
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
        title="Automated Billing Runs"
        subtitle="Execute recurring subscription batch cycles, simulate dry-runs with tax validation, and resolve failed billing items."
        breadcrumbs={[
          { label: 'Staff Workspace', link: '/staff' },
          { label: 'Billing Runs' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={actionLoading}
              onClick={handleDryRun}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 hover:bg-[#F5F5F5] text-[#333333] rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              <FileCheck className="w-3.5 h-3.5 text-[#00796B]" />
              <span>Simulate Dry Run</span>
            </button>

            <button
              type="button"
              disabled={actionLoading}
              onClick={handleCommitRun}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1F4E79] hover:bg-[#163a5c] text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Commit Billing Run</span>
            </button>
          </div>
        }
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

      {/* Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center gap-3">
        <Search className="w-4 h-4 text-[#4B6584] shrink-0" />
        <input
          type="text"
          placeholder="Search billing runs by run number (RUN-...), summary, or operator..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-xs rounded-xl focus:outline-none font-medium text-[#333333]"
        />
      </div>

      {/* Runs Table */}
      <DataTable
        columns={columns}
        data={filteredRuns}
        loading={loading}
        emptyTitle="No billing runs found"
        emptyDescription="No automated or manual billing batches executed."
      />
    </div>
  );
};

export default BillingRunsPage;
