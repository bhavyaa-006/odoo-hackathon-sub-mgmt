import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  PlusCircle,
  Search,
  Filter,
  Eye,
} from 'lucide-react';
import { quotationService } from '../../../services/quotation.service';
import StaffPageHeader from '../../../components/staff/StaffPageHeader';
import DataTable from '../../../components/staff/DataTable';
import StatusBadge from '../../../components/ui/StatusBadge';
import Money from '../../../components/ui/Money';

export const QuotationsPage = () => {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    let isMounted = true;
    const fetchQuotations = async () => {
      try {
        setLoading(true);
        const res = await quotationService.getStaffQuotations();
        if (isMounted) {
          setQuotations(res.quotations || []);
        }
      } catch (err) {
        console.error('Failed to load quotations:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchQuotations();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredQuotations = quotations.filter((q) => {
    const term = search.toLowerCase().trim();
    const matchesSearch =
      !term ||
      q.quotation_number?.toLowerCase().includes(term) ||
      q.customer_name?.toLowerCase().includes(term) ||
      q.customer_company?.toLowerCase().includes(term) ||
      q.title?.toLowerCase().includes(term);

    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const columns = [
    {
      header: 'Quotation #',
      accessor: (q) => (
        <div className="min-w-0">
          <Link
            to={`/staff/quotations/${q.id}`}
            className="font-bold text-xs text-[#1F4E79] hover:underline block truncate"
          >
            {q.quotation_number}
          </Link>
          <div className="text-[11px] text-[#4B6584] truncate">{q.title}</div>
        </div>
      ),
    },
    {
      header: 'Customer',
      accessor: (q) => (
        <div className="min-w-0 text-xs">
          <span className="font-bold text-[#333333] block truncate">
            {q.customer_company || q.customer_name}
          </span>
          <span className="text-[11px] text-[#4B6584] truncate block">
            {q.customer_name}
          </span>
        </div>
      ),
    },
    {
      header: 'Dates',
      accessor: (q) => (
        <div className="text-xs">
          <span className="text-[#333333] font-medium">{q.created_date}</span>
          <div className="text-[10px] text-[#4B6584]">Valid to: {q.valid_until}</div>
        </div>
      ),
    },
    {
      header: 'Total (incl. GST)',
      accessor: (q) => (
        <div className="text-xs font-bold text-[#333333]">
          <Money minor={q.total_minor || 0} />
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (q) => <StatusBadge status={q.status || 'draft'} />,
    },
    {
      header: 'Actions',
      className: 'text-right',
      accessor: (q) => (
        <div className="flex items-center justify-end">
          <Link
            to={`/staff/quotations/${q.id}`}
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
        title="Quotations & Proposals"
        subtitle="Author tailored subscription proposals, apply templates, and convert confirmed quotes to active contracts."
        breadcrumbs={[
          { label: 'Staff Workspace', link: '/staff' },
          { label: 'Quotations' },
        ]}
        actions={
          <Link
            to="/staff/quotations/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1F4E79] hover:bg-[#163a5c] text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Create Quotation</span>
          </Link>
        }
      />

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-[#4B6584] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search quotations by quote number, customer, or title..."
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
            <option value="quotation">Sent / Quotation</option>
            <option value="confirmed">Confirmed (Converted)</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {/* Quotations Table */}
      <DataTable
        columns={columns}
        data={filteredQuotations}
        loading={loading}
        emptyTitle="No quotations found"
        emptyDescription={
          search
            ? `No quotation matches "${search}".`
            : 'No quotations found in the current workspace.'
        }
      />
    </div>
  );
};

export default QuotationsPage;
