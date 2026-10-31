import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  PlusCircle,
  Search,
  Filter,
  Eye,
} from 'lucide-react';
import { paymentService } from '../../../services/payment.service';
import StaffPageHeader from '../../../components/staff/StaffPageHeader';
import DataTable from '../../../components/staff/DataTable';
import Money from '../../../components/ui/Money';

export const PaymentsPage = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');

  useEffect(() => {
    let isMounted = true;
    const fetchPayments = async () => {
      try {
        setLoading(true);
        const res = await paymentService.getPayments();
        if (isMounted) {
          setPayments(res.payments || []);
        }
      } catch (err) {
        console.error('Failed to load payments:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchPayments();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredPayments = payments.filter((p) => {
    const term = search.toLowerCase().trim();
    const matchesSearch =
      !term ||
      p.payment_reference?.toLowerCase().includes(term) ||
      p.customer_name?.toLowerCase().includes(term) ||
      p.customer_company?.toLowerCase().includes(term) ||
      p.transaction_reference?.toLowerCase().includes(term) ||
      p.invoice_number?.toLowerCase().includes(term);

    const matchesMethod =
      methodFilter === 'all' ||
      p.payment_method?.toLowerCase().includes(methodFilter.toLowerCase());

    return matchesSearch && matchesMethod;
  });

  const columns = [
    {
      header: 'Payment Ref',
      accessor: (p) => (
        <div className="min-w-0">
          <Link
            to={`/staff/payments/${p.id}`}
            className="font-bold text-xs text-[#1F4E79] hover:underline block truncate"
          >
            {p.payment_reference}
          </Link>
          <span className="text-[10px] text-slate-400 truncate block">
            Txn: {p.transaction_reference || 'N/A'}
          </span>
        </div>
      ),
    },
    {
      header: 'Customer',
      accessor: (p) => (
        <div className="min-w-0 text-xs">
          <Link
            to={`/staff/customers/${p.customer_id}`}
            className="font-bold text-[#333333] hover:underline block truncate"
          >
            {p.customer_company || p.customer_name}
          </Link>
          <span className="text-[11px] text-[#4B6584] truncate block">
            {p.customer_name}
          </span>
        </div>
      ),
    },
    {
      header: 'Date & Method',
      accessor: (p) => (
        <div className="text-xs">
          <span className="text-[#333333] font-medium">
            {new Date(p.payment_date).toLocaleDateString()}
          </span>
          <div className="text-[10px] text-[#4B6584] font-medium">
            {p.payment_method}
          </div>
        </div>
      ),
    },
    {
      header: 'Allocated Invoice',
      accessor: (p) => (
        <div className="text-xs">
          {p.invoice_id ? (
            <Link
              to={`/staff/invoices/${p.invoice_id}`}
              className="font-bold text-[#1F4E79] hover:underline"
            >
              {p.invoice_number}
            </Link>
          ) : (
            <span className="text-slate-400">Unallocated</span>
          )}
        </div>
      ),
    },
    {
      header: 'Amount Reconciled',
      accessor: (p) => (
        <div className="text-xs font-bold text-emerald-700">
          <Money minor={p.amount_minor || 0} />
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (p) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
            p.status === 'completed'
              ? 'bg-emerald-100 text-emerald-800'
              : p.status === 'pending'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-rose-100 text-rose-800'
          }`}
        >
          {p.status}
        </span>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      accessor: (p) => (
        <div className="flex items-center justify-end">
          <Link
            to={`/staff/payments/${p.id}`}
            className="p-1.5 text-[#1F4E79] hover:bg-[#E3F2FD] rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-bold"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Receipt</span>
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <StaffPageHeader
        title="Payments & Collections Ledger"
        subtitle="Record B2B receipts, match incoming NEFT / UPI wire payments, and track reconciled invoices."
        breadcrumbs={[
          { label: 'Staff Workspace', link: '/staff' },
          { label: 'Payments' },
        ]}
        actions={
          <Link
            to="/staff/payments/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1F4E79] hover:bg-[#163a5c] text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Record Payment</span>
          </Link>
        }
      />

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-[#4B6584] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search payments by reference, customer, invoice, or UTR number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-[#4B6584] shrink-0" />
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] bg-white font-medium text-[#333333]"
          >
            <option value="all">All Methods</option>
            <option value="transfer">Bank Transfer / NEFT</option>
            <option value="upi">UPI Auto-pay</option>
            <option value="card">Credit Card</option>
            <option value="cheque">Cheque</option>
          </select>
        </div>
      </div>

      {/* Payments Table */}
      <DataTable
        columns={columns}
        data={filteredPayments}
        loading={loading}
        emptyTitle="No payments found"
        emptyDescription={
          search
            ? `No payment matches "${search}".`
            : 'No collections or payment records found in workspace.'
        }
      />
    </div>
  );
};

export default PaymentsPage;
