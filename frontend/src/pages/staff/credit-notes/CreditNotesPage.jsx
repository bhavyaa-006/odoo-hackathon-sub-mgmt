import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  PlusCircle,
  Search,
  Eye,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { creditNoteService } from '../../../services/creditNote.service';
import { customerService } from '../../../services/customer.service';
import { invoiceService } from '../../../services/invoice.service';
import StaffPageHeader from '../../../components/staff/StaffPageHeader';
import DataTable from '../../../components/staff/DataTable';
import StatusBadge from '../../../components/ui/StatusBadge';
import Money from '../../../components/ui/Money';

export const CreditNotesPage = () => {
  const [creditNotes, setCreditNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [reason, setReason] = useState('Service Outage SLA Credit');
  const [amountRupees, setAmountRupees] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);

  const fetchCreditNotes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await creditNoteService.getCreditNotes();
      setCreditNotes(res.credit_notes || []);
    } catch (err) {
      console.error('Failed to load credit notes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const res = await creditNoteService.getCreditNotes();
        if (isMounted) setCreditNotes(res.credit_notes || []);
      } catch (err) {
        console.error('Failed to load credit notes:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    run();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleOpenCreateModal = async () => {
    setCreateModalOpen(true);
    try {
      const [custRes, invRes] = await Promise.all([
        customerService.getStaffCustomers(),
        invoiceService.getStaffInvoices(),
      ]);
      setCustomers(custRes.customers || []);
      setInvoices(invRes.invoices || []);
      if (custRes.customers?.length > 0) {
        setSelectedCustomerId(custRes.customers[0].id);
      }
    } catch (err) {
      console.error('Failed to load options for credit note modal:', err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const amountMinor = Math.round(Number(amountRupees || 0) * 100);
    if (!amountMinor || amountMinor <= 0) {
      setNotice({ type: 'error', message: 'Amount must be greater than zero.' });
      return;
    }

    try {
      setSubmitting(true);
      const res = await creditNoteService.createCreditNote({
        customer_id: selectedCustomerId,
        original_invoice_id: selectedInvoiceId || null,
        reason,
        amount_minor: amountMinor,
      });

      setNotice({
        type: 'success',
        message: res.message || 'Credit note successfully generated!',
      });
      setCreateModalOpen(false);
      fetchCreditNotes();
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      setNotice({
        type: 'error',
        message: err.message || 'Failed to create credit note.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCreditNotes = creditNotes.filter((cn) => {
    const term = search.toLowerCase().trim();
    return (
      !term ||
      cn.credit_note_number?.toLowerCase().includes(term) ||
      cn.customer_name?.toLowerCase().includes(term) ||
      cn.customer_company?.toLowerCase().includes(term) ||
      cn.original_invoice_number?.toLowerCase().includes(term)
    );
  });

  const columns = [
    {
      header: 'Credit Note #',
      accessor: (cn) => (
        <div className="min-w-0">
          <Link
            to={`/staff/credit-notes/${cn.id}`}
            className="font-bold text-xs text-[#1F4E79] hover:underline block truncate"
          >
            {cn.credit_note_number}
          </Link>
          <span className="text-[10px] text-slate-400">
            {cn.issue_date}
          </span>
        </div>
      ),
    },
    {
      header: 'Customer',
      accessor: (cn) => (
        <div className="min-w-0 text-xs">
          <Link
            to={`/staff/customers/${cn.customer_id}`}
            className="font-bold text-[#333333] hover:underline block truncate"
          >
            {cn.customer_company || cn.customer_name}
          </Link>
          <span className="text-[11px] text-[#4B6584] truncate block">
            {cn.customer_name}
          </span>
        </div>
      ),
    },
    {
      header: 'Original Invoice',
      accessor: (cn) => (
        <div className="text-xs">
          {cn.original_invoice_id ? (
            <Link
              to={`/staff/invoices/${cn.original_invoice_id}`}
              className="font-bold text-[#1F4E79] hover:underline"
            >
              {cn.original_invoice_number}
            </Link>
          ) : (
            <span className="text-slate-400">General Adjustment</span>
          )}
        </div>
      ),
    },
    {
      header: 'Reason',
      accessor: (cn) => (
        <div className="text-xs text-[#4B6584] max-w-[200px] truncate" title={cn.reason}>
          {cn.reason}
        </div>
      ),
    },
    {
      header: 'Total Credit',
      accessor: (cn) => (
        <div className="text-xs font-bold text-[#333333]">
          <Money minor={cn.total_minor || 0} />
        </div>
      ),
    },
    {
      header: 'Remaining Balance',
      accessor: (cn) => (
        <div className="text-xs font-bold text-emerald-700">
          <Money minor={cn.remaining_credit_minor ?? cn.total_minor} />
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (cn) => <StatusBadge status={cn.status || 'issued'} />,
    },
    {
      header: 'Actions',
      className: 'text-right',
      accessor: (cn) => (
        <div className="flex items-center justify-end">
          <Link
            to={`/staff/credit-notes/${cn.id}`}
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
        title="Credit Notes & Adjustments"
        subtitle="Issue billing credits, SLA adjustments, and apply credit balances against pending invoices."
        breadcrumbs={[
          { label: 'Staff Workspace', link: '/staff' },
          { label: 'Credit Notes' },
        ]}
        actions={
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1F4E79] hover:bg-[#163a5c] text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Issue Credit Note</span>
          </button>
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
          placeholder="Search credit notes by credit note number (CN-...), customer, or invoice..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-xs rounded-xl focus:outline-none font-medium text-[#333333]"
        />
      </div>

      {/* Credit Notes Table */}
      <DataTable
        columns={columns}
        data={filteredCreditNotes}
        loading={loading}
        emptyTitle="No credit notes found"
        emptyDescription="No credit notes or negative billing adjustments in the workspace."
      />

      {/* Create Modal */}
      {createModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold font-heading text-[#1F4E79]">
                Issue New Credit Note
              </h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-[#4B6584] hover:text-[#333333]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-[#333333] block mb-1">
                  Customer Account *
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name} ({c.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#333333] block mb-1">
                  Original Invoice (Optional)
                </label>
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => setSelectedInvoiceId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium"
                >
                  <option value="">General Account Credit</option>
                  {invoices
                    .filter((i) => !selectedCustomerId || i.customer_id === selectedCustomerId)
                    .map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_number} (₹{(inv.total_minor / 100).toFixed(2)})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#333333] block mb-1">
                  Credit Amount (₹) *
                </label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="e.g. 1500.00"
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#333333] block mb-1">
                  Reason for Credit Note *
                </label>
                <input
                  required
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-bold text-[#4B6584] hover:bg-[#F5F5F5] rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#1F4E79] hover:bg-[#163a5c] rounded-xl disabled:opacity-50"
                >
                  {submitting ? 'Generating...' : 'Generate Credit Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditNotesPage;
