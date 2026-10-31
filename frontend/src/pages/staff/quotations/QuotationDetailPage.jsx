import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Send,
  CheckCircle,
  Printer,
  AlertCircle,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { quotationService } from '../../../services/quotation.service';
import StatusBadge from '../../../components/ui/StatusBadge';
import Money from '../../../components/ui/Money';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

export const QuotationDetailPage = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [quotation, setQuotation] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  const fetchQuotation = useCallback(async () => {
    try {
      setLoading(true);
      const res = await quotationService.getStaffQuotation(id);
      setQuotation(res);
    } catch (err) {
      console.error('Failed to load quotation:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const res = await quotationService.getStaffQuotation(id);
        if (isMounted) setQuotation(res);
      } catch (err) {
        console.error('Failed to load quotation:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    run();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleSend = async () => {
    try {
      setActionLoading(true);
      const res = await quotationService.sendQuotation(id);
      setNotice({
        type: 'success',
        message: res.message || 'Quotation dispatched to customer email.',
      });
      fetchQuotation();
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      setNotice({
        type: 'error',
        message: err.message || 'Failed to send quotation.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirm = async () => {
    try {
      setActionLoading(true);
      const res = await quotationService.confirmQuotation(id);
      setNotice({
        type: 'success',
        message: res.message || 'Quotation confirmed! Subscription created.',
      });
      fetchQuotation();
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      setNotice({
        type: 'error',
        message: err.message || 'Failed to confirm quotation.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading quotation details..." />
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto my-12">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-[#1F4E79]">Quotation Not Found</h3>
        <Link
          to="/staff/quotations"
          className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-[#1F4E79] text-white rounded-xl text-xs font-bold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Quotations</span>
        </Link>
      </div>
    );
  }

  const steps = [
    { key: 'draft', label: '1. Draft Proposal' },
    { key: 'quotation', label: '2. Sent to Customer' },
    { key: 'confirmed', label: '3. Confirmed & Converted' },
  ];

  const currentStepIndex =
    quotation.status === 'confirmed' ? 2 : quotation.status === 'quotation' ? 1 : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link
        to="/staff/quotations"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4B6584] hover:text-[#1F4E79] transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Quotations</span>
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

      {/* Lifecycle Progress Stepper */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {steps.map((st, idx) => {
            const isCompleted = idx <= currentStepIndex;
            return (
              <div key={st.key} className="flex items-center gap-2 text-xs">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
                    isCompleted
                      ? 'bg-[#1F4E79] text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {idx + 1}
                </div>
                <span
                  className={`font-semibold ${
                    isCompleted ? 'text-[#1F4E79]' : 'text-slate-400'
                  }`}
                >
                  {st.label}
                </span>
                {idx < steps.length - 1 && (
                  <div className="w-12 h-0.5 bg-slate-200 hidden sm:block mx-2" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Quotation Document Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold font-heading text-[#1F4E79]">
                {quotation.quotation_number}
              </h1>
              <StatusBadge status={quotation.status} />
            </div>
            <p className="text-xs text-[#4B6584] mt-1">{quotation.title}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => window.print()}
              className="p-2 border border-slate-300 hover:bg-[#F5F5F5] rounded-xl text-[#4B6584] transition-colors cursor-pointer"
              title="Print quotation"
            >
              <Printer className="w-4 h-4" />
            </button>

            {quotation.status === 'draft' && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleSend}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#00796B] hover:bg-[#005f54] text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Proposal</span>
              </button>
            )}

            {quotation.status !== 'confirmed' && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirm}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#1F4E79] hover:bg-[#163a5c] text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Convert to Subscription</span>
              </button>
            )}

            {quotation.converted_subscription_id && (
              <Link
                to={`/staff/subscriptions/${quotation.converted_subscription_id}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#E0F2F1] text-[#00796B] hover:bg-[#b2dfdb] text-xs font-bold rounded-xl transition-colors"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>View Converted Subscription</span>
              </Link>
            )}
          </div>
        </div>

        {/* Customer & Quotation Meta */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#4B6584] block">
              Customer Account
            </span>
            <Link
              to={`/staff/customers/${quotation.customer_id}`}
              className="font-bold text-sm text-[#1F4E79] hover:underline block"
            >
              {quotation.customer_company || quotation.customer_name}
            </Link>
            <p className="text-[#333333]">{quotation.customer_name}</p>
            <p className="text-[#4B6584]">{quotation.customer_email}</p>
          </div>

          <div className="space-y-1 sm:text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#4B6584] block">
              Proposal Metadata
            </span>
            <p className="text-[#333333]">
              <strong>Created:</strong> {quotation.created_date}
            </p>
            <p className="text-[#333333]">
              <strong>Valid Until:</strong> {quotation.valid_until}
            </p>
            <p className="text-[#4B6584]">
              <strong>Billing Interval:</strong> {quotation.billing_interval || 'Monthly'}
            </p>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F5F5F5] border-b border-slate-200 text-[#4B6584] font-bold">
                <th className="py-2.5 px-4">Line Item / Product</th>
                <th className="py-2.5 px-4">Cycle</th>
                <th className="py-2.5 px-4 text-center">Qty</th>
                <th className="py-2.5 px-4 text-right">Unit Price</th>
                <th className="py-2.5 px-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(quotation.lines || []).map((line, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 font-bold text-[#333333]">
                    {line.product_name}
                  </td>
                  <td className="py-3 px-4 capitalize text-[#4B6584]">
                    {line.billing_interval || 'Monthly'}
                  </td>
                  <td className="py-3 px-4 text-center font-medium">{line.quantity}</td>
                  <td className="py-3 px-4 text-right font-medium">
                    <Money minor={line.unit_price_minor || 0} />
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-[#1F4E79]">
                    <Money
                      minor={(line.unit_price_minor || 0) * (line.quantity || 1)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals & GST Summary */}
        <div className="flex justify-end">
          <div className="w-full sm:w-72 space-y-2 text-xs">
            <div className="flex justify-between text-[#4B6584]">
              <span>Subtotal:</span>
              <span className="font-semibold text-[#333333]">
                <Money minor={quotation.subtotal_minor || 0} />
              </span>
            </div>

            {(quotation.discount_minor || 0) > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Special Discount:</span>
                <span className="font-semibold">
                  -<Money minor={quotation.discount_minor} />
                </span>
              </div>
            )}

            <div className="flex justify-between text-[#4B6584]">
              <span>Taxable Subtotal:</span>
              <span className="font-semibold text-[#333333]">
                <Money
                  minor={
                    Math.max(
                      0,
                      (quotation.subtotal_minor || 0) - (quotation.discount_minor || 0)
                    )
                  }
                />
              </span>
            </div>

            <div className="flex justify-between text-[#4B6584]">
              <span>GST 18% (CGST 9% + SGST 9%):</span>
              <span className="font-semibold text-[#333333]">
                <Money minor={quotation.tax_minor || 0} />
              </span>
            </div>

            <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-bold text-[#1F4E79]">
              <span>Proposal Total:</span>
              <span><Money minor={quotation.total_minor || 0} /></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuotationDetailPage;
