import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { paymentService } from '../../../services/payment.service';
import { invoiceService } from '../../../services/invoice.service';
import { customerService } from '../../../services/customer.service';
import Money from '../../../components/ui/Money';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

export const RecordPaymentPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedInvoiceId = searchParams.get('invoice_id');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(preselectedInvoiceId || '');
  const [amountRupees, setAmountRupees] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer (NEFT/RTGS)');
  const [txnReference, setTxnReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchInit = async () => {
      try {
        setLoading(true);
        const [invRes, custRes] = await Promise.all([
          invoiceService.getStaffInvoices(),
          customerService.getStaffCustomers(),
        ]);

        if (isMounted) {
          const allInvoices = invRes.invoices || [];
          setInvoices(allInvoices);
          setCustomers(custRes.customers || []);

          if (preselectedInvoiceId) {
            const foundInv = allInvoices.find((i) => i.id === preselectedInvoiceId);
            if (foundInv) {
              setSelectedCustomerId(foundInv.customer_id);
              setSelectedInvoiceId(foundInv.id);
              setAmountRupees((foundInv.outstanding_minor / 100).toFixed(2));
            }
          } else if (allInvoices.length > 0) {
            const openInvoices = allInvoices.filter((i) => (i.outstanding_minor || 0) > 0);
            if (openInvoices.length > 0) {
              setSelectedCustomerId(openInvoices[0].customer_id);
              setSelectedInvoiceId(openInvoices[0].id);
              setAmountRupees((openInvoices[0].outstanding_minor / 100).toFixed(2));
            }
          }
        }
      } catch (err) {
        console.error('Failed to load payment options:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchInit();
    return () => {
      isMounted = false;
    };
  }, [preselectedInvoiceId]);

  // Outstanding invoices for the currently selected customer
  const customerInvoices = invoices.filter(
    (i) => (!selectedCustomerId || i.customer_id === selectedCustomerId) && (i.outstanding_minor || 0) > 0
  );

  const selectedInvoice = invoices.find((i) => i.id === selectedInvoiceId);

  const handleInvoiceChange = (invId) => {
    setSelectedInvoiceId(invId);
    const inv = invoices.find((i) => i.id === invId);
    if (inv) {
      setAmountRupees((inv.outstanding_minor / 100).toFixed(2));
    }
  };

  const amountMinor = Math.round(Number(amountRupees || 0) * 100);
  const maxMinor = selectedInvoice ? selectedInvoice.outstanding_minor : 0;
  const isOverpayment = amountMinor > maxMinor;
  const remainingMinor = Math.max(0, maxMinor - amountMinor);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedInvoiceId) {
      setNotice({ type: 'error', message: 'Please select an invoice to allocate payment.' });
      return;
    }
    if (amountMinor <= 0) {
      setNotice({ type: 'error', message: 'Payment amount must be greater than zero.' });
      return;
    }
    if (isOverpayment) {
      setNotice({
        type: 'error',
        message: `Overpayment violation: Amount cannot exceed invoice outstanding of ₹${(maxMinor / 100).toFixed(2)}.`,
      });
      return;
    }

    try {
      setSubmitting(true);
      const res = await paymentService.recordPayment({
        invoice_id: selectedInvoiceId,
        amount_minor: amountMinor,
        payment_method: paymentMethod,
        transaction_reference: txnReference || `TXN-${Date.now().toString().slice(-6)}`,
        payment_date: paymentDate,
        notes,
      });

      setNotice({
        type: 'success',
        message: res.message || 'Payment successfully recorded and reconciled!',
      });

      setTimeout(() => {
        navigate(`/staff/payments/${res.payment?.id || ''}`);
      }, 700);
    } catch (err) {
      setNotice({
        type: 'error',
        message: err.userMessage || err.message || 'Failed to record payment.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading receivables ledger..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link
        to="/staff/payments"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4B6584] hover:text-[#1F4E79] transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Payments</span>
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

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold font-heading text-[#1F4E79]">
          Record Customer Payment
        </h1>
        <p className="text-xs text-[#4B6584] mt-1">
          Allocate incoming wire, UPI, or cheque receipts to outstanding customer invoices with overpayment protection.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Customer & Invoice Selection */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#4B6584]">
            1. Invoice Allocation
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-[#333333] block mb-1">
                Customer Account *
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => {
                  setSelectedCustomerId(e.target.value);
                  setSelectedInvoiceId('');
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] bg-white font-medium"
              >
                <option value="">All Customers with Open Invoices</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name} ({c.name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-[#333333] block mb-1">
                Target Invoice *
              </label>
              <select
                required
                value={selectedInvoiceId}
                onChange={(e) => handleInvoiceChange(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] bg-white font-medium"
              >
                <option value="">Select outstanding invoice...</option>
                {customerInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number} — Outstanding: ₹{(inv.outstanding_minor / 100).toFixed(2)} ({inv.customer_company})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Selected Invoice Overview Box */}
          {selectedInvoice && (
            <div className="p-4 rounded-xl bg-[#E3F2FD]/40 border border-[#1F4E79]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
              <div>
                <span className="font-bold text-[#1F4E79]">
                  {selectedInvoice.invoice_number}
                </span>
                <p className="text-[#4B6584] mt-0.5">
                  Billed to: <strong>{selectedInvoice.customer_company}</strong> • Due: {selectedInvoice.due_date}
                </p>
              </div>
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-[10px] text-[#4B6584] uppercase font-bold block">
                    Invoice Total
                  </span>
                  <span className="font-bold text-[#333333]">
                    <Money minor={selectedInvoice.total_minor} />
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#4B6584] uppercase font-bold block">
                    Outstanding Due
                  </span>
                  <span className="font-bold text-rose-600">
                    <Money minor={selectedInvoice.outstanding_minor} />
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Payment Parameters */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#4B6584]">
            2. Payment Details & Reconciled Amount
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-[#333333] block mb-1">
                Payment Amount (₹) *
              </label>
              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                className={`w-full px-3 py-2 text-xs rounded-xl border font-bold ${
                  isOverpayment
                    ? 'border-rose-500 focus:ring-rose-500 text-rose-600'
                    : 'border-slate-300 focus:ring-[#1F4E79] text-[#1F4E79]'
                } focus:outline-none focus:ring-2`}
              />
              {isOverpayment ? (
                <span className="text-[10px] font-bold text-rose-600 mt-1 block">
                  Cannot exceed max outstanding of ₹{(maxMinor / 100).toFixed(2)}
                </span>
              ) : (
                <span className="text-[10px] text-[#4B6584] mt-1 block">
                  Partial payments recalculate remaining balance automatically.
                </span>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-[#333333] block mb-1">
                Payment Method *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] bg-white font-medium"
              >
                <option value="Bank Transfer (NEFT/RTGS)">Bank Transfer (NEFT/RTGS)</option>
                <option value="UPI Auto-pay">UPI Auto-pay / QR</option>
                <option value="Credit Card">Corporate Credit Card</option>
                <option value="Cheque Clearance">Cheque Clearance</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-[#333333] block mb-1">
                Payment Receipt Date
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-[#333333] block mb-1">
                Transaction Reference / UTR / Cheque # *
              </label>
              <input
                required
                type="text"
                placeholder="e.g. UTR-HDFC-992812"
                value={txnReference}
                onChange={(e) => setTxnReference(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] font-medium"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#333333] block mb-1">
                Internal Collections Note
              </label>
              <input
                type="text"
                placeholder="Optional audit comment"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] font-medium"
              />
            </div>
          </div>

          {/* Real-time Reconciliation Preview */}
          {selectedInvoice && !isOverpayment && amountMinor > 0 && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <span className="text-[#4B6584]">
                Invoice balance after this settlement:
              </span>
              <div className="font-bold">
                {remainingMinor === 0 ? (
                  <span className="text-emerald-700 font-extrabold">
                    Fully Settled (Status: PAID)
                  </span>
                ) : (
                  <span className="text-amber-800">
                    Remaining Due: <Money minor={remainingMinor} />
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-3">
          <Link
            to="/staff/payments"
            className="px-4 py-2 border border-slate-300 text-xs font-bold text-[#4B6584] hover:bg-[#F5F5F5] rounded-xl transition-colors"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={submitting || isOverpayment || amountMinor <= 0}
            className="px-5 py-2.5 bg-[#1F4E79] hover:bg-[#163a5c] text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          >
            {submitting ? 'Recording & Reconciling...' : 'Record Payment Receipt'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RecordPaymentPage;
