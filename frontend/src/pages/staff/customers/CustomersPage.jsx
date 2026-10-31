import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Filter,
  Eye,
  UserCheck,
  Layers,
} from 'lucide-react';
import { customerService } from '../../../services/customer.service';
import StaffPageHeader from '../../../components/staff/StaffPageHeader';
import DataTable from '../../../components/staff/DataTable';
import StatusBadge from '../../../components/ui/StatusBadge';
import Money from '../../../components/ui/Money';

export const CustomersPage = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    let isMounted = true;
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        const res = await customerService.getStaffCustomers();
        if (isMounted) {
          setCustomers(res.customers || []);
        }
      } catch (err) {
        console.error('Failed to load customers:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchCustomers();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredCustomers = customers.filter((c) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      c.name?.toLowerCase().includes(q) ||
      c.company_name?.toLowerCase().includes(q) ||
      c.customer_number?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.gstin?.toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === 'all' ||
      c.status === statusFilter ||
      (statusFilter === 'overdue' && (c.reconciled_balance_minor || 0) > 0);

    return matchesSearch && matchesStatus;
  });

  const columns = [
    {
      header: 'Customer',
      accessor: (c) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#E3F2FD] text-[#1F4E79] flex items-center justify-center font-bold text-xs shrink-0">
            {c.name ? c.name.slice(0, 2).toUpperCase() : 'CU'}
          </div>
          <div className="min-w-0">
            <Link
              to={`/staff/customers/${c.id}`}
              className="font-bold text-[#1F4E79] hover:underline truncate block"
            >
              {c.company_name || c.name}
            </Link>
            <div className="text-[11px] text-[#4B6584] truncate">
              {c.name} • {c.customer_number}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'GSTIN / State',
      accessor: (c) => (
        <div className="text-xs">
          <span className="font-mono text-[11px] text-[#333333] font-semibold">
            {c.gstin || 'Non-GST B2C'}
          </span>
          <div className="text-[10px] text-[#4B6584]">{c.state || 'Karnataka'}</div>
        </div>
      ),
    },
    {
      header: 'Assigned Staff',
      accessor: (c) => (
        <div className="text-xs flex items-center gap-1.5 text-[#333333] font-medium">
          <UserCheck className="w-3.5 h-3.5 text-[#00796B]" />
          <span>{c.assigned_staff_name || 'Unassigned'}</span>
        </div>
      ),
    },
    {
      header: 'Active Subs',
      accessor: (c) => (
        <div className="text-xs flex items-center gap-1 text-[#4B6584] font-semibold">
          <Layers className="w-3.5 h-3.5 text-[#1F4E79]" />
          <span>{c.active_subscriptions_count ?? 1}</span>
        </div>
      ),
    },
    {
      header: 'Open Balance',
      accessor: (c) => (
        <div className="text-xs font-bold text-[#333333]">
          <Money minor={c.reconciled_balance_minor || 0} />
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (c) => <StatusBadge status={c.status || 'active'} />,
    },
    {
      header: 'Actions',
      className: 'text-right',
      accessor: (c) => (
        <div className="flex items-center justify-end">
          <Link
            to={`/staff/customers/${c.id}`}
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
        title="Customer Directory"
        subtitle="Manage B2B and enterprise accounts, assign staff specialists, and inspect customer ledgers."
        breadcrumbs={[
          { label: 'Staff Workspace', link: '/staff' },
          { label: 'Customers' },
        ]}
      />

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-[#4B6584] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by customer name, company, GSTIN, customer ID or email..."
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
            <option value="overdue">Overdue Balance</option>
            <option value="churned">Churned</option>
          </select>
        </div>
      </div>

      {/* Customer Data Table */}
      <DataTable
        columns={columns}
        data={filteredCustomers}
        loading={loading}
        emptyTitle="No customers found"
        emptyDescription={
          search
            ? `No customer matches the query "${search}".`
            : 'No customers available in the workspace.'
        }
      />
    </div>
  );
};

export default CustomersPage;
