import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { billingService } from '../../../services/billing.service';
import Money from '../../../components/ui/Money';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

export const BillingRunDetailPage = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [run, setRun] = useState(null);
  const [activeTab, setActiveTab] = useState('eligible'); // 'eligible' | 'skipped' | 'failed'
  const [retryLoading, setRetryLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  const fetchRun = useCallback(async () => {
    try {
      setLoading(true);
      const res = await billingService.getBillingRun(id);
      setRun(res);
      if (res.failed_list && res.failed_list.length > 0) {
        setActiveTab('failed');
      }
    } catch (err) {
      console.error('Failed to load billing run:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let isMounted = true;
    const runFetch = async () => {
      try {
        setLoading(true);
        const res = await billingService.getBillingRun(id);
        if (isMounted) {
          setRun(res);
          if (res.failed_list && res.failed_list.length > 0) {
            setActiveTab('failed');
          }
        }
      } catch (err) {
        console.error('Failed to load billing run:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    runFetch();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleRetryItem = async (itemId) => {
    try {
      setRetryLoading(true);
      const res = await billingService.retryBillingRunItem(id, itemId);
      setNotice({
        type: 'success',
        message: res.message || 'Item retried successfully and invoice generated!',
      });
      fetchRun();
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      setNotice({
        type: 'error',
        message: err.message || 'Failed to retry billing item.',
      });
    } finally {
      setRetryLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading billing run manifest..." />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto my-12">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-[#1F4E79]">Billing Run Not Found</h3>
        <Link
          to="/staff/billing-runs"
          className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-[#1F4E79] text-white rounded-xl text-xs font-bold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Billing Runs</span>
        </Link>
      </div>
    );
  }

  const eligibleList = run.eligible_list || [];
  const skippedList = run.skipped_list || [];
  const failedList = run.failed_list || [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link
        to="/staff/billing-runs"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4B6584] hover:text-[#1F4E79] transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Billing Runs</span>
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

      {/* Main Run Summary Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold font-heading text-[#1F4E79]">
                {run.run_number}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-emerald-100 text-emerald-800">
                {run.status || 'Committed'}
              </span>
            </div>
            <p className="text-xs text-[#4B6584] mt-1">
              Billing Cycle: {run.billing_period} • Executed by {run.executed_by}
            </p>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-[#4B6584] uppercase font-bold block">
              Total Invoiced Batch
            </span>
            <div className="text-2xl font-bold font-heading text-[#1F4E79] mt-0.5">
              <Money minor={run.total_amount_minor || 0} />
            </div>
          </div>
        </div>

        {/* Counts Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-[#F5F5F5]/60 border border-slate-200 text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#4B6584] block">
              Processed
            </span>
            <span className="font-bold text-base text-[#333333]">
              {run.total_subscriptions_processed || 0}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#00796B] block">
              Invoices Generated
            </span>
            <span className="font-bold text-base text-[#00796B]">
              {run.invoices_generated || 0}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#4B6584] block">
              Skipped Subscriptions
            </span>
            <span className="font-bold text-base text-[#4B6584]">
              {run.skipped_subscriptions || 0}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block">
              Failed Items
            </span>
            <span className={`font-bold text-base ${failedList.length > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
              {failedList.length}
            </span>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="border-b border-slate-200">
          <nav className="flex space-x-2" aria-label="Run Manifest Tabs">
            <button
              onClick={() => setActiveTab('eligible')}
              className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'eligible'
                  ? 'bg-[#1F4E79] text-white shadow-xs'
                  : 'text-[#4B6584] hover:bg-[#F5F5F5]'
              }`}
            >
              Invoiced Items ({eligibleList.length})
            </button>
            <button
              onClick={() => setActiveTab('skipped')}
              className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'skipped'
                  ? 'bg-[#1F4E79] text-white shadow-xs'
                  : 'text-[#4B6584] hover:bg-[#F5F5F5]'
              }`}
            >
              Skipped ({skippedList.length})
            </button>
            {failedList.length > 0 && (
              <button
                onClick={() => setActiveTab('failed')}
                className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'failed'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-rose-600 hover:bg-rose-50'
                }`}
              >
                Failed Items ({failedList.length})
              </button>
            )}
          </nav>
        </div>

        {/* Tab Panels */}
        {activeTab === 'eligible' && (
          <div className="space-y-2">
            {eligibleList.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-[#333333]">{item.customer_name}</span>
                  <p className="text-[11px] text-[#4B6584] mt-0.5">
                    Sub: {item.subscription_number} • {item.plan_name}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="font-bold text-[#1F4E79]">
                    <Money minor={item.amount_minor || 0} />
                  </div>
                  {item.generated_invoice_number && (
                    <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-[#E3F2FD] text-[#1F4E79]">
                      {item.generated_invoice_number}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'skipped' && (
          <div className="space-y-2">
            {skippedList.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-[#333333]">{item.customer_name}</span>
                  <span className="text-[11px] text-[#4B6584] ml-2">
                    ({item.subscription_number})
                  </span>
                </div>
                <div className="text-xs text-[#4B6584] font-medium max-w-sm text-right">
                  {item.reason}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'failed' && (
          <div className="space-y-3">
            {failedList.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-rose-200 bg-rose-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#333333]">{item.customer_name}</span>
                    <span className="font-mono text-[10px] font-bold text-rose-700 bg-white px-2 py-0.5 rounded border border-rose-200">
                      {item.error_code}
                    </span>
                  </div>
                  <p className="text-rose-800 font-medium">{item.error_message}</p>
                </div>

                {item.can_retry && (
                  <button
                    type="button"
                    disabled={retryLoading}
                    onClick={() => handleRetryItem(item.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-50 shrink-0 self-start sm:self-center"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${retryLoading ? 'animate-spin' : ''}`} />
                    <span>Retry Billing Item</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BillingRunDetailPage;
