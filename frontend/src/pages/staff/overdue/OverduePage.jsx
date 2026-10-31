import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Filter,
  MessageSquare,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { invoiceService } from '../../../services/invoice.service';
import StaffPageHeader from '../../../components/staff/StaffPageHeader';
import DataTable from '../../../components/staff/DataTable';
import Money from '../../../components/ui/Money';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

export const OverduePage = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedBucket, setSelectedBucket] = useState('all'); // 'all' | '1-30' | '31-60' | '61-90' | '90+'
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState(null);
  const [followUpNote, setFollowUpNote] = useState('');
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const res = await invoiceService.getOverdueSummary();
        if (isMounted) setData(res);
      } catch (err) {
        console.error('Failed to load overdue summary:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    run();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSaveNote = (e) => {
    e.preventDefault();
    if (!followUpNote.trim()) return;

    setNotice({
      type: 'success',
      message: `Follow-up note logged for invoice ${activeInvoice?.invoice_number}.`,
    });
    setNoteModalOpen(false);
    setFollowUpNote('');
    setTimeout(() => setNotice(null), 4000);
  };

  if (loading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading aging schedules and receivables..." />
      </div>
    );
  }

  const summary = data?.summary || {};
  const buckets = data?.aging_buckets || [];
  const invoices = data?.invoices || [];

  const filteredInvoices = invoices.filter((inv) => {
    const term = search.toLowerCase().trim();
    const matchesSearch =
      !term ||
      inv.invoice_number?.toLowerCase().includes(term) ||
      inv.customer_name?.toLowerCase().includes(term) ||
      inv.customer_company?.toLowerCase().includes(term);

    const days = inv.days_overdue || 0;
    let matchesBucket = true;
    if (selectedBucket === '1-30') matchesBucket = days >= 1 && days <= 30;
    else if (selectedBucket === '31-60') matchesBucket = days >= 31 && days <= 60;
    else if (selectedBucket === '61-90') matchesBucket = days >= 61 && days <= 90;
    else if (selectedBucket === '90+') matchesBucket = days > 90;

    return matchesSearch && matchesBucket;
  });

  const columns = [
    {
      header: 'Invoice #',
      accessor: (inv) => (
        <div className="min-w-0">
          <Link
            to={`/staff/invoices/${inv.id}`}
            className="font-bold text-xs text-[#1F4E79] hover:underline block truncate"
          >
            {inv.invoice_number}
          </Link>
          <span className="text-[10px] text-slate-400">Due: {inv.due_date}</span>
        </div>
      ),
    },
    {
      header: 'Customer',
      accessor: (inv) => (
        <div className="min-w-0 text-xs">
          <Link
            to={`/staff/customers/${inv.customer_id}`}
            className="font-bold text-[#333333] hover:underline block truncate"
          >
            {inv.customer_company || inv.customer_name}
          </Link>
          <span className="text-[11px] text-[#4B6584] truncate block">
            {inv.customer_name}
          </span>
        </div>
      ),
    },
    {
      header: 'Aging',
      accessor: (inv) => {
        const days = inv.days_overdue || 1;
        const colorClass =
          days > 90
            ? 'bg-rose-100 text-rose-800'
            : days > 60
            ? 'bg-amber-100 text-amber-800'
            : days > 30
            ? 'bg-amber-50 text-amber-700'
            : 'bg-slate-100 text-slate-700';

        return (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${colorClass}`}>
            {days} Days Past Due
          </span>
        );
      },
    },
    {
      header: 'Outstanding Balance',
      accessor: (inv) => (
        <div className="text-xs font-bold text-rose-600">
          <Money minor={inv.outstanding_minor || 0} />
        </div>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      accessor: (inv) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => {
              setActiveInvoice(inv);
              setNoteModalOpen(true);
            }}
            className="p-1.5 text-[#1F4E79] hover:bg-[#E3F2FD] rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-bold cursor-pointer"
            title="Log note"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Follow-up</span>
          </button>
          <Link
            to={`/staff/invoices/${inv.id}`}
            className="p-1.5 text-[#4B6584] hover:bg-[#F5F5F5] rounded-lg text-xs font-bold"
          >
            View
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <StaffPageHeader
        title="Overdue Receivables & Aging"
        subtitle="Track delinquent invoices across aging buckets, record collections notes, and supervise dunning escalation."
        breadcrumbs={[
          { label: 'Staff Workspace', link: '/staff' },
          { label: 'Overdue Invoices' },
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

      {/* Summary KPI Strip */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-[10px] uppercase font-bold text-[#4B6584] block">Total Overdue Receivables</span>
            <div className="text-base font-bold text-rose-600 mt-0.5">
              <Money minor={summary.total_overdue_amount_minor || 0} />
            </div>
          </div>
          <div className="border-l border-slate-200 pl-6">
            <span className="text-[10px] uppercase font-bold text-[#4B6584] block">Delinquent Invoices</span>
            <div className="text-base font-bold text-[#1F4E79] mt-0.5">
              {summary.total_overdue_invoices || invoices.length}
            </div>
          </div>
        </div>
        <div className="text-right text-[11px] text-[#4B6584]">
          Aging evaluated as of workspace operations clock.
        </div>
      </div>

      {/* 4 Aging Buckets Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {buckets.map((b) => {
          const isSelected = selectedBucket === b.bucket_id;
          return (
            <button
              key={b.bucket_id}
              onClick={() => setSelectedBucket(isSelected ? 'all' : b.bucket_id)}
              className={`p-5 rounded-2xl border text-left transition-all cursor-pointer shadow-xs ${
                isSelected
                  ? 'border-[#1F4E79] bg-[#E3F2FD]/50 ring-2 ring-[#1F4E79]'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#4B6584]">
                  {b.bucket_label}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                  {b.invoice_count} Invoices
                </span>
              </div>
              <div className="text-lg font-bold font-heading text-[#1F4E79] mt-2">
                <Money minor={b.amount_minor || 0} />
              </div>
              <p className="text-[10px] text-[#4B6584] mt-1">{b.action_recommendation}</p>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-[#4B6584] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search overdue invoices by number, customer, or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-[#4B6584] shrink-0" />
          <select
            value={selectedBucket}
            onChange={(e) => setSelectedBucket(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] bg-white font-medium text-[#333333]"
          >
            <option value="all">All Aging Buckets</option>
            <option value="1-30">1–30 Days (Current/Grace)</option>
            <option value="31-60">31–60 Days (Moderate)</option>
            <option value="61-90">61–90 Days (High Risk)</option>
            <option value="90+">&gt;90 Days (Severe)</option>
          </select>
        </div>
      </div>

      {/* Overdue Table */}
      <DataTable
        columns={columns}
        data={filteredInvoices}
        loading={loading}
        emptyTitle="No overdue invoices in this view"
        emptyDescription="All invoices in this aging bucket are settled or up to date."
      />

      {/* Follow-up Note Modal */}
      {noteModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold font-heading text-[#1F4E79]">
                Log Follow-up Note: {activeInvoice?.invoice_number}
              </h3>
              <button
                onClick={() => setNoteModalOpen(false)}
                className="text-[#4B6584] hover:text-[#333333]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNote} className="mt-4 space-y-4">
              <p className="text-xs text-[#4B6584]">
                Customer: <strong>{activeInvoice?.customer_company}</strong> • Outstanding Due:{' '}
                <strong className="text-rose-600">
                  <Money minor={activeInvoice?.outstanding_minor || 0} />
                </strong>
              </p>

              <div>
                <label className="text-xs font-bold text-[#333333] block mb-1">
                  Follow-up Notes / Phone Call Summary *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="e.g. Spoke with Accounts Payable manager. Cheque clearance scheduled for Friday."
                  value={followUpNote}
                  onChange={(e) => setFollowUpNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNoteModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-bold text-[#4B6584] hover:bg-[#F5F5F5] rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-[#1F4E79] hover:bg-[#163a5c] rounded-xl"
                >
                  Save Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OverduePage;
