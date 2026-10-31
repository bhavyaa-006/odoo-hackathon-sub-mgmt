import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Printer,
  CheckCircle,
  CreditCard,
  FileMinus,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { invoiceService } from '../../../services/invoice.service';
import StatusBadge from '../../../components/ui/StatusBadge';
import Money from '../../../components/ui/Money';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

export const InvoiceDetailPage = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [creditReason, setCreditReason] = useState('Customer Billing Adjustment / SLA Credit');
  const [notice, setNotice] = useState(null);

  const fetchInvoice = useCallback(async () => {
    try {
      setLoading(true);
      const res = await invoiceService.getStaffInvoice(id);
      setInvoice(res);
    } catch (err) {
      console.error('Failed to load invoice:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const res = await invoiceService.getStaffInvoice(id);
        if (isMounted) setInvoice(res);
      } catch (err) {
        console.error('Failed to load invoice:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    run();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleConfirm = async () => {
    try {
      setActionLoading(true);
      const res = await invoiceService.confirmInvoice(id);
      setNotice({
        type: 'success',
        message: res.message || 'Invoice confirmed and posted to ledger.',
      });
      fetchInvoice();
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      setNotice({
        type: 'error',
        message: err.message || 'Failed to confirm invoice.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelWithCreditNote = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await invoiceService.cancelInvoiceWithCreditNote(id, {
        reason: creditReason,
      });
      setNotice({
        type: 'success',
        message: res.message || 'Credit note generated and invoice cancelled.',
      });
      setCreditModalOpen(false);
      fetchInvoice();
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      setNotice({
        type: 'error',
        message: err.message || 'Failed to cancel invoice.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading tax invoice statement..." />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto my-12">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-[#1F4E79]">Invoice Not Found</h3>
        <Link
          to="/staff/invoices"
          className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-[#1F4E79] text-white rounded-xl text-xs font-bold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Invoices</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link
        to="/staff/invoices"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4B6584] hover:text-[#1F4E79] transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Invoices</span>
      </Link>

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

      {/* Main Invoice Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold font-heading text-[#1F4E79]">
                Tax Invoice: {invoice.invoice_number}
              </h1>
              <StatusBadge status={invoice.status} />
            </div>
            <p className="text-xs text-[#4B6584] mt-1">
              SAC Code: 998313 (Information Technology SaaS Hosting & Operations)
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => window.print()}
              className="p-2 border border-slate-300 hover:bg-[#F5F5F5] rounded-xl text-[#4B6584] transition-colors cursor-pointer"
              title="Print invoice"
            >
              <Printer className="w-4 h-4" />
            </button>

            {invoice.status === 'draft' && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirm}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#00796B] hover:bg-[#005f54] text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Confirm & Post Invoice</span>
              </button>
            )}

            {(invoice.outstanding_minor || 0) > 0 && invoice.status !== 'draft' && invoice.status !== 'cancelled' && (
              <Link
                to={`/staff/payments/new?invoice_id=${invoice.id}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#1F4E79] hover:bg-[#163a5c] text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Record Payment</span>
              </Link>
            )}

            {invoice.status !== 'draft' && invoice.status !== 'cancelled' && (
              <button
                type="button"
                onClick={() => setCreditModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-rose-300 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                <FileMinus className="w-3.5 h-3.5" />
                <span>Issue Credit Note</span>
              </button>
            )}
          </div>
        </div>

        {/* GST Billing Entities Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          <div className="p-4 rounded-xl bg-[#F5F5F5]/60 border border-slate-200 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F4E79] block">
              Billed From (Service Provider)
            </span>
            <p className="font-bold text-sm text-[#333333]">Brightloop Technologies Private Limited</p>
            <p className="text-[#4B6584]">GSTIN: 29AABCB1234F1Z8</p>
            <p className="text-[#4B6584]">Outer Ring Road, Bellandur, Bengaluru, Karnataka 560103</p>
          </div>

          <div className="p-4 rounded-xl bg-[#F5F5F5]/60 border border-slate-200 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#00796B] block">
              Billed To (Customer)
            </span>
            <Link
              to={`/staff/customers/${invoice.customer_id}`}
              className="font-bold text-sm text-[#1F4E79] hover:underline block truncate"
            >
              {invoice.customer_company || invoice.customer_name}
            </Link>
            <p className="text-[#4B6584]">
              GSTIN: <span className="font-mono font-bold text-[#333333]">{invoice.gstin || 'Non-GST'}</span>
            </p>
            <p className="text-[#4B6584]">State: {invoice.customer_state || 'Karnataka'}</p>
          </div>
        </div>

        {/* Invoice Meta */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs border-y border-slate-100 py-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#4B6584] block">
              Issue Date
            </span>
            <span className="font-semibold text-[#333333]">{invoice.issue_date}</span>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#4B6584] block">
              Due Date
            </span>
            <span className="font-semibold text-[#333333]">{invoice.due_date}</span>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#4B6584] block">
              Total Amount
            </span>
            <div className="font-bold text-[#1F4E79]">
              <Money minor={invoice.total_minor || 0} />
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#4B6584] block">
              Outstanding Due
            </span>
            <div className="font-bold text-rose-600">
              <Money minor={invoice.outstanding_minor || 0} />
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F5F5F5] border-b border-slate-200 text-[#4B6584] font-bold">
                <th className="py-2.5 px-4">Item / Description</th>
                <th className="py-2.5 px-4">SAC Code</th>
                <th className="py-2.5 px-4 text-center">Qty</th>
                <th className="py-2.5 px-4 text-right">Unit Rate</th>
                <th className="py-2.5 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(invoice.lines || [
                {
                  description: 'Enterprise Cloud Subscription Platform',
                  sac_code: '998313',
                  quantity: 1,
                  unit_price_minor: invoice.subtotal_minor || invoice.total_minor,
                },
              ]).map((line, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 font-bold text-[#333333]">
                    {line.description || line.product_name}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-[#4B6584]">
                    {line.sac_code || '998313'}
                  </td>
                  <td className="py-3 px-4 text-center font-medium">{line.quantity || 1}</td>
                  <td className="py-3 px-4 text-right font-medium">
                    <Money minor={line.unit_price_minor || 0} />
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-[#1F4E79]">
                    <Money minor={(line.unit_price_minor || 0) * (line.quantity || 1)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* GST Tax Summary Calculation */}
        <div className="flex justify-end">
          <div className="w-full sm:w-72 space-y-2 text-xs">
            <div className="flex justify-between text-[#4B6584]">
              <span>Taxable Subtotal:</span>
              <span className="font-semibold text-[#333333]">
                <Money minor={invoice.subtotal_minor || Math.round((invoice.total_minor || 0) / 1.18)} />
              </span>
            </div>

            {invoice.customer_state === 'Karnataka' || !invoice.customer_state ? (
              <>
                <div className="flex justify-between text-[#4B6584]">
                  <span>CGST (9%):</span>
                  <span className="font-semibold text-[#333333]">
                    <Money minor={invoice.cgst_minor || Math.round((invoice.tax_minor || 0) / 2)} />
                  </span>
                </div>
                <div className="flex justify-between text-[#4B6584]">
                  <span>SGST (9%):</span>
                  <span className="font-semibold text-[#333333]">
                    <Money minor={invoice.sgst_minor || Math.round((invoice.tax_minor || 0) / 2)} />
                  </span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-[#4B6584]">
                <span>IGST (18%):</span>
                <span className="font-semibold text-[#333333]">
                  <Money minor={invoice.igst_minor || invoice.tax_minor || 0} />
                </span>
              </div>
            )}

            <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-bold text-[#1F4E79]">
              <span>Total Invoiced:</span>
              <span><Money minor={invoice.total_minor || 0} /></span>
            </div>

            <div className="flex justify-between text-emerald-700 font-semibold">
              <span>Paid to Date:</span>
              <span>-<Money minor={(invoice.total_minor || 0) - (invoice.outstanding_minor || 0)} /></span>
            </div>

            <div className="flex justify-between pt-1 border-t border-slate-200 font-bold text-rose-600">
              <span>Outstanding Due:</span>
              <span><Money minor={invoice.outstanding_minor || 0} /></span>
            </div>
          </div>
        </div>

        {/* Payments Settlement Ledger */}
        {invoice.payments && invoice.payments.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#4B6584]">
              Settlement & Reconciled Payments
            </h3>
            <div className="space-y-2">
              {invoice.payments.map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/50 border border-emerald-200 text-xs"
                >
                  <div>
                    <span className="font-bold text-[#333333]">{p.payment_reference}</span>
                    <span className="text-[11px] text-[#4B6584] ml-2">
                      {p.payment_date} via {p.payment_method}
                    </span>
                  </div>
                  <div className="font-bold text-emerald-800">
                    <Money minor={p.amount_minor || 0} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Credit Note Modal */}
      {creditModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold font-heading text-rose-700">
                Issue Credit Note & Cancel Invoice
              </h3>
              <button
                onClick={() => setCreditModalOpen(false)}
                className="text-[#4B6584] hover:text-[#333333]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCancelWithCreditNote} className="mt-4 space-y-4">
              <p className="text-xs text-[#4B6584] leading-relaxed">
                Issuing a credit note will void the outstanding balance on invoice{' '}
                <strong>{invoice.invoice_number}</strong> and credit{' '}
                <Money minor={invoice.outstanding_minor || invoice.total_minor || 0} /> to the customer account.
              </p>

              <div>
                <label className="text-xs font-bold text-[#333333] block mb-1">
                  Reason for Credit Adjustment *
                </label>
                <textarea
                  required
                  rows={3}
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreditModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-bold text-[#4B6584] hover:bg-[#F5F5F5] rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl disabled:opacity-50"
                >
                  {actionLoading ? 'Issuing...' : 'Issue Credit Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceDetailPage;
