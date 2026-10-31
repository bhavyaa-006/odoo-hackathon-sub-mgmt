import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Printer,
  AlertCircle,
} from 'lucide-react';
import { paymentService } from '../../../services/payment.service';
import Money from '../../../components/ui/Money';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

export const PaymentDetailPage = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchPayment = async () => {
      try {
        setLoading(true);
        const res = await paymentService.getPayment(id);
        if (isMounted) setPayment(res);
      } catch (err) {
        console.error('Failed to load payment receipt:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchPayment();
    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading payment receipt..." />
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto my-12">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-[#1F4E79]">Payment Not Found</h3>
        <Link
          to="/staff/payments"
          className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-[#1F4E79] text-white rounded-xl text-xs font-bold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Payments</span>
        </Link>
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

      {/* Main Payment Receipt Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold font-heading text-[#1F4E79]">
                Receipt: {payment.payment_reference}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 uppercase">
                {payment.status || 'Completed'}
              </span>
            </div>
            <p className="text-xs text-[#4B6584] mt-1">
              Settled via {payment.payment_method}
            </p>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 hover:bg-[#F5F5F5] rounded-xl text-xs font-bold text-[#4B6584] transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Printer className="w-4 h-4" />
            <span>Print Receipt</span>
          </button>
        </div>

        {/* Amount Paid Callout */}
        <div className="p-5 rounded-2xl bg-[#E0F2F1]/50 border border-[#00796B]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#00796B]">
              Total Reconciled Amount
            </span>
            <div className="text-2xl font-bold font-heading text-[#00796B] mt-0.5">
              <Money minor={payment.amount_minor || 0} />
            </div>
          </div>
          <div className="text-xs text-[#4B6584] text-right">
            <div>Payment Date: <strong>{new Date(payment.payment_date).toLocaleDateString()}</strong></div>
            <div>Currency: <strong>{payment.currency || 'INR'}</strong></div>
          </div>
        </div>

        {/* Payment & Allocation Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          <div className="p-4 rounded-xl bg-[#F5F5F5]/60 border border-slate-200 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F4E79] block">
              Customer Account
            </span>
            <Link
              to={`/staff/customers/${payment.customer_id}`}
              className="font-bold text-sm text-[#1F4E79] hover:underline block"
            >
              {payment.customer_company || payment.customer_name}
            </Link>
            <p className="text-[#4B6584]">Contact: {payment.customer_name}</p>
          </div>

          <div className="p-4 rounded-xl bg-[#F5F5F5]/60 border border-slate-200 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#00796B] block">
              Allocated Invoice
            </span>
            {payment.invoice_id ? (
              <Link
                to={`/staff/invoices/${payment.invoice_id}`}
                className="font-bold text-sm text-[#00796B] hover:underline block"
              >
                {payment.invoice_number}
              </Link>
            ) : (
              <span className="text-slate-400">Unallocated</span>
            )}
            <p className="text-[#4B6584]">
              Reconciled towards tax invoice ledger
            </p>
          </div>
        </div>

        {/* Transaction Metadata Table */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#4B6584]">
            Banking & Audit Metadata
          </h3>
          <div className="divide-y divide-slate-100 text-xs">
            <div className="flex justify-between py-2">
              <span className="text-[#4B6584]">Transaction / UTR Reference</span>
              <span className="font-mono font-bold text-[#333333]">
                {payment.transaction_reference}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-[#4B6584]">Payment Method</span>
              <span className="font-semibold text-[#333333]">{payment.payment_method}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-[#4B6584]">Recorded By Staff</span>
              <span className="font-semibold text-[#1F4E79]">
                {payment.recorded_by || 'Sarah Chen'}
              </span>
            </div>
            {payment.notes && (
              <div className="flex justify-between py-2">
                <span className="text-[#4B6584]">Internal Notes</span>
                <span className="text-[#333333] font-medium">{payment.notes}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentDetailPage;
