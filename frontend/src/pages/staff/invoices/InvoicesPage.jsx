import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Filter,
  Eye,
} from 'lucide-react';
import { invoiceService } from '../../../services/invoice.service';
import StaffPageHeader from '../../../components/staff/StaffPageHeader';
import DataTable from '../../../components/staff/DataTable';
import StatusBadge from '../../../components/ui/StatusBadge';
import Money from '../../../components/ui/Money';

export const InvoicesPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    let isMounted = true;
    const fetchInvoices = async () => {
      try {
        setLoading(true);
        const res = await invoiceService.getStaffInvoices();
        if (isMounted) {
          setInvoices(res.invoices || []);
        }
      } catch (err) {
        console.error('Failed to load invoices:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchInvoices();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredInvoices = invoices.filter((inv) => {
    const term = search.toLowerCase().trim();
    const matchesSearch =
      !term ||
      inv.invoice_number?.toLowerCase().includes(term) ||
      inv.customer_name?.toLowerCase().includes(term) ||
      inv.customer_company?.toLowerCase().includes(term);

    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;

    return matchesSearch && matchesStatus;
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
          <span className="text-[10px] text-slate-400">
            {inv.gstin || 'B2C / Intra-state'}
          </span>
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
      header: 'Dates',
      accessor: (inv) => (
        <div className="text-xs">
          <span className="text-[#333333] font-medium">{inv.issue_date}</span>
          <div className="text-[10px] text-[#4B6584]">
            Due: {inv.due_date}
            {inv.days_overdue > 0 && (
              <span className="text-rose-600 font-bold ml-1">
                ({inv.days_overdue}d)
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      header: 'Total (incl. GST)',
      accessor: (inv) => (
        <div className="text-xs font-bold text-[#333333]">
          <Money minor={inv.total_minor || 0} />
        </div>
      ),
    },
    {
      header: 'Outstanding',
      accessor: (inv) => (
        <div className="text-xs font-bold text-[#1F4E79]">
          <Money minor={inv.outstanding_minor || 0} />
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (inv) => <StatusBadge status={inv.status} />,
    },
    {
      header: 'Actions',
      className: 'text-right',
      accessor: (inv) => (
        <div className="flex items-center justify-end">
          <Link
            to={`/staff/invoices/${inv.id}`}
            className="p-1.5 text-[#1F4E79] hover:bg-[#E3F2FD] rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-bold"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Manage</span>
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <StaffPageHeader
        title="Invoices & Billing Ledger"
        subtitle="Review tax invoices, verify GST calculations, confirm pending drafts, and issue credit adjustments."
        breadcrumbs={[
          { label: 'Staff Workspace', link: '/staff' },
          { label: 'Invoices' },
        ]}
      />

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-[#4B6584] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search invoices by invoice number (INV-...), customer name, or company..."
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
            <option value="draft">Draft</option>
            <option value="posted">Posted / Open</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      <DataTable
        columns={columns}
        data={filteredInvoices}
        loading={loading}
        emptyTitle="No invoices found"
        emptyDescription={
          search
            ? `No invoice matches "${search}".`
            : 'No billing invoices recorded in the current workspace.'
        }
      />
    </div>
  );
};

export default InvoicesPage;
