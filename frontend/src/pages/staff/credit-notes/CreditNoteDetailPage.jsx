import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Printer,
} from 'lucide-react';
import { creditNoteService } from '../../../services/creditNote.service';
import { invoiceService } from '../../../services/invoice.service';
import StatusBadge from '../../../components/ui/StatusBadge';
import Money from '../../../components/ui/Money';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

export const CreditNoteDetailPage = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [creditNote, setCreditNote] = useState(null);
  const [openInvoices, setOpenInvoices] = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [applyAmountRupees, setApplyAmountRupees] = useState('');
  const [applying, setApplying] = useState(false);
  const [notice, setNotice] = useState(null);

  const fetchCreditNote = useCallback(async () => {
    try {
      setLoading(true);
      const res = await creditNoteService.getCreditNote(id);
      setCreditNote(res);

      if (res.customer_id) {
        const invRes = await invoiceService.getStaffInvoices({ customer_id: res.customer_id });
        const eligible = (invRes.invoices || []).filter(
          (i) => i.customer_id === res.customer_id && (i.outstanding_minor || 0) > 0
        );
        setOpenInvoices(eligible);
        if (eligible.length > 0) {
          setSelectedInvoiceId(eligible[0].id);
          const maxApply = Math.min(
            res.remaining_credit_minor ?? res.total_minor,
            eligible[0].outstanding_minor
          );
          setApplyAmountRupees((maxApply / 100).toFixed(2));
        }
      }
    } catch (err) {
      console.error('Failed to load credit note:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const res = await creditNoteService.getCreditNote(id);
        if (isMounted) {
          setCreditNote(res);
          if (res.customer_id) {
            const invRes = await invoiceService.getStaffInvoices({ customer_id: res.customer_id });
            const eligible = (invRes.invoices || []).filter(
              (i) => i.customer_id === res.customer_id && (i.outstanding_minor || 0) > 0
            );
            if (isMounted) {
              setOpenInvoices(eligible);
              if (eligible.length > 0) {
                setSelectedInvoiceId(eligible[0].id);
                const maxApply = Math.min(
                  res.remaining_credit_minor ?? res.total_minor,
                  eligible[0].outstanding_minor
                );
                setApplyAmountRupees((maxApply / 100).toFixed(2));
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to load credit note:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    run();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleApply = async (e) => {
    e.preventDefault();
    const amountMinor = Math.round(Number(applyAmountRupees || 0) * 100);
    if (!amountMinor || amountMinor <= 0) {
      setNotice({ type: 'error', message: 'Amount must be greater than zero.' });
      return;
    }

    try {
      setApplying(true);
      const res = await creditNoteService.applyCredit(id, {
        invoice_id: selectedInvoiceId,
        amount_minor: amountMinor,
      });

      setNotice({
        type: 'success',
        message: res.message || 'Credit note applied against invoice successfully!',
      });
      fetchCreditNote();
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      setNotice({
        type: 'error',
        message: err.message || 'Failed to apply credit note.',
      });
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading credit note statement..." />
      </div>
    );
  }

  if (!creditNote) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto my-12">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-[#1F4E79]">Credit Note Not Found</h3>
        <Link
          to="/staff/credit-notes"
          className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-[#1F4E79] text-white rounded-xl text-xs font-bold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Credit Notes</span>
        </Link>
      </div>
    );
  }

  const remainingMinor = creditNote.remaining_credit_minor ?? creditNote.total_minor;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link
        to="/staff/credit-notes"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4B6584] hover:text-[#1F4E79] transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Credit Notes</span>
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

      {/* Credit Note Statement Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold font-heading text-[#1F4E79]">
                {creditNote.credit_note_number}
              </h1>
              <StatusBadge status={creditNote.status || 'issued'} />
            </div>
            <p className="text-xs text-[#4B6584] mt-1">
              Issued on {creditNote.issue_date} • Reason: {creditNote.reason}
            </p>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="p-2 border border-slate-300 hover:bg-[#F5F5F5] rounded-xl text-[#4B6584] transition-colors cursor-pointer self-start sm:self-auto"
            title="Print credit note"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>

        {/* Customer & Original Invoice Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-[#F5F5F5]/60 border border-slate-200 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F4E79] block">
              Beneficiary Customer
            </span>
            <Link
              to={`/staff/customers/${creditNote.customer_id}`}
              className="font-bold text-sm text-[#1F4E79] hover:underline block"
            >
              {creditNote.customer_company || creditNote.customer_name}
            </Link>
            <p className="text-[#4B6584]">{creditNote.customer_name}</p>
          </div>

          <div className="p-4 rounded-xl bg-[#F5F5F5]/60 border border-slate-200 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#4B6584] block">
              Related Document
            </span>
            {creditNote.original_invoice_id ? (
              <Link
                to={`/staff/invoices/${creditNote.original_invoice_id}`}
                className="font-bold text-sm text-[#1F4E79] hover:underline block"
              >
                {creditNote.original_invoice_number}
              </Link>
            ) : (
              <span className="text-[#333333] font-semibold block text-sm">
                General Account Adjustment
              </span>
            )}
            <p className="text-[#4B6584]">Negative liability ledger entry</p>
          </div>
        </div>

        {/* Balance Callout */}
        <div className="p-5 rounded-2xl bg-[#E3F2FD]/40 border border-[#1F4E79]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1F4E79]">
              Total Credit Issued
            </span>
            <div className="text-xl font-bold font-heading text-[#1F4E79] mt-0.5">
              <Money minor={creditNote.total_minor || 0} />
            </div>
          </div>

          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#00796B]">
              Remaining Available Credit
            </span>
            <div className="text-xl font-bold font-heading text-[#00796B] mt-0.5">
              <Money minor={remainingMinor} />
            </div>
          </div>
        </div>

        {/* Apply Credit Section */}
        {remainingMinor > 0 && openInvoices.length > 0 && (
          <form
            onSubmit={handleApply}
            className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-4"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#1F4E79]">
              Apply Credit Towards Customer Invoice
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-[#333333] block mb-1">
                  Target Outstanding Invoice
                </label>
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => {
                    setSelectedInvoiceId(e.target.value);
                    const inv = openInvoices.find((i) => i.id === e.target.value);
                    if (inv) {
                      const maxApply = Math.min(remainingMinor, inv.outstanding_minor);
                      setApplyAmountRupees((maxApply / 100).toFixed(2));
                    }
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium"
                >
                  {openInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} (Outstanding: ₹{(inv.outstanding_minor / 100).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#333333] block mb-1">
                  Amount to Apply (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={applyAmountRupees}
                  onChange={(e) => setApplyAmountRupees(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={applying}
                className="px-4 py-2 bg-[#00796B] hover:bg-[#005f54] text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                {applying ? 'Applying...' : 'Apply Credit to Invoice'}
              </button>
            </div>
          </form>
        )}

        {/* Consumed / Allocations History */}
        {creditNote.applied_invoices && creditNote.applied_invoices.length > 0 && (
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#4B6584]">
              Applied Invoices Ledger
            </h3>
            <div className="space-y-2">
              {creditNote.applied_invoices.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-[#1F4E79]">{item.invoice_number}</span>
                    <span className="text-[11px] text-[#4B6584] ml-2">
                      Applied on {item.applied_date}
                    </span>
                  </div>
                  <div className="font-bold text-[#333333]">
                    <Money minor={item.amount_minor || 0} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreditNoteDetailPage;
