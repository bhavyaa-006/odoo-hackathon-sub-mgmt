import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  XCircle,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { subscriptionService, AVAILABLE_PLANS } from '../../../services/subscription.service';
import StatusBadge from '../../../components/ui/StatusBadge';
import Money from '../../../components/ui/Money';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

export const SubscriptionDetailPage = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  // Plan change modal state
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('');

  const fetchSubscription = useCallback(async () => {
    try {
      setLoading(true);
      const res = await subscriptionService.getStaffSubscription(id);
      setSubscription(res);
      setSelectedPlanId(res.plan_id || 'plan-enterprise');
    } catch (err) {
      console.error('Failed to load subscription:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const res = await subscriptionService.getStaffSubscription(id);
        if (isMounted) {
          setSubscription(res);
          setSelectedPlanId(res.plan_id || 'plan-enterprise');
        }
      } catch (err) {
        console.error('Failed to load subscription:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    run();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleAction = async (actionName) => {
    try {
      setActionLoading(true);
      const res = await subscriptionService.performStaffAction(id, actionName);
      setNotice({
        type: 'success',
        message: res.message || `Action "${actionName}" executed successfully!`,
      });
      fetchSubscription();
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      setNotice({
        type: 'error',
        message: err.message || `Failed to execute ${actionName}.`,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleApplyPlanChange = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await subscriptionService.applyPlanChange(id, {
        target_plan_id: selectedPlanId,
      });
      setNotice({
        type: 'success',
        message: res.message || 'Subscription plan updated successfully!',
      });
      setPlanModalOpen(false);
      fetchSubscription();
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      setNotice({
        type: 'error',
        message: err.message || 'Failed to update subscription plan.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading subscription contract details..." />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto my-12">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-[#1F4E79]">Subscription Not Found</h3>
        <Link
          to="/staff/subscriptions"
          className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-[#1F4E79] text-white rounded-xl text-xs font-bold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Subscriptions</span>
        </Link>
      </div>
    );
  }

  const lifecycleStages = [
    { key: 'draft', label: 'Draft' },
    { key: 'quotation', label: 'Quotation' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'active', label: 'Active' },
    { key: 'closed', label: 'Closed' },
  ];

  const getStageIndex = (st) => {
    if (st === 'closed') return 4;
    if (st === 'active' || st === 'paused' || st === 'past_due') return 3;
    if (st === 'confirmed') return 2;
    if (st === 'quotation') return 1;
    return 0;
  };

  const currentStageIndex = getStageIndex(subscription.status);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link
        to="/staff/subscriptions"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4B6584] hover:text-[#1F4E79] transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Subscriptions</span>
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

      {/* Visual Lifecycle Stepper */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {lifecycleStages.map((stage, idx) => {
            const isCompleted = idx <= currentStageIndex;
            const isCurrent = idx === currentStageIndex;
            return (
              <div key={stage.key} className="flex items-center gap-2 text-xs">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] ${
                    isCurrent
                      ? 'bg-[#1F4E79] text-white ring-4 ring-[#E3F2FD]'
                      : isCompleted
                      ? 'bg-[#00796B] text-white'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {idx + 1}
                </div>
                <span
                  className={`font-semibold hidden sm:inline ${
                    isCurrent
                      ? 'text-[#1F4E79] font-bold'
                      : isCompleted
                      ? 'text-[#00796B]'
                      : 'text-slate-400'
                  }`}
                >
                  {stage.label}
                </span>
                {idx < lifecycleStages.length - 1 && (
                  <div className="w-8 sm:w-16 h-0.5 bg-slate-200 mx-1" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Subscription Master Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold font-heading text-[#1F4E79]">
                {subscription.subscription_number}
              </h1>
              <StatusBadge status={subscription.status} />
            </div>
            <p className="text-sm font-semibold text-[#333333] mt-1">
              {subscription.plan_name}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {subscription.status === 'confirmed' && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleAction('activate')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#00796B] hover:bg-[#005f54] text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Activate Subscription</span>
              </button>
            )}

            {subscription.status === 'active' && (
              <>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleAction('pause')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 hover:bg-[#F5F5F5] text-xs font-bold text-[#333333] rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPlanModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#E3F2FD] text-[#1F4E79] hover:bg-[#1F4E79] hover:text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Change Plan</span>
                </button>

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleAction('renew')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#1F4E79] hover:bg-[#163a5c] text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Renew</span>
                </button>

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleAction('cancel')}
                  className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                  title="Cancel subscription"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </>
            )}

            {subscription.status === 'paused' && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleAction('resume')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#00796B] hover:bg-[#005f54] text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Resume Subscription</span>
              </button>
            )}
          </div>
        </div>

        {/* Customer & Period Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl bg-[#F5F5F5]/60 border border-slate-200 text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#4B6584] block">
              Customer Account
            </span>
            <Link
              to={`/staff/customers/${subscription.customer_id}`}
              className="font-bold text-[#1F4E79] hover:underline mt-0.5 block truncate"
            >
              {subscription.customer_company || subscription.customer_name}
            </Link>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#4B6584] block">
              Start Date
            </span>
            <span className="font-semibold text-[#333333] mt-0.5 block">
              {subscription.start_date || 'N/A'}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#4B6584] block">
              Next Billing Date
            </span>
            <span className="font-semibold text-[#1F4E79] mt-0.5 block">
              {subscription.next_billing_date || subscription.current_period_end || 'N/A'}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#4B6584] block">
              Recurring Price
            </span>
            <div className="font-bold text-[#333333] mt-0.5">
              <Money minor={subscription.unit_price_minor || 0} /> / {subscription.billing_interval || 'month'}
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#4B6584]">
            Subscription Contract Lines
          </h3>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F5F5F5] border-b border-slate-200 text-[#4B6584] font-bold">
                  <th className="py-2.5 px-4">Line Item</th>
                  <th className="py-2.5 px-4">Frequency</th>
                  <th className="py-2.5 px-4 text-center">Qty</th>
                  <th className="py-2.5 px-4 text-right">Recurring Unit Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(subscription.lines || [
                  {
                    product_name: subscription.plan_name,
                    quantity: 1,
                    billing_interval: subscription.billing_interval,
                    unit_price_minor: subscription.unit_price_minor,
                  },
                ]).map((line, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-bold text-[#333333]">
                      {line.product_name}
                    </td>
                    <td className="py-3 px-4 capitalize text-[#4B6584]">
                      {line.billing_interval || 'Monthly'}
                    </td>
                    <td className="py-3 px-4 text-center font-medium">{line.quantity || 1}</td>
                    <td className="py-3 px-4 text-right font-bold text-[#1F4E79]">
                      <Money minor={line.unit_price_minor || 0} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Plan Change Modal */}
      {planModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold font-heading text-[#1F4E79]">
                Change Subscription Tier
              </h3>
              <button
                onClick={() => setPlanModalOpen(false)}
                className="text-[#4B6584] hover:text-[#333333]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyPlanChange} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-[#333333] block mb-1">
                  Select Target Plan
                </label>
                <div className="space-y-2">
                  {(AVAILABLE_PLANS || []).map((p) => (
                    <label
                      key={p.id}
                      className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        selectedPlanId === p.id
                          ? 'border-[#1F4E79] bg-[#E3F2FD]/40 ring-1 ring-[#1F4E79]'
                          : 'border-slate-200 hover:bg-[#F5F5F5]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="plan"
                          value={p.id}
                          checked={selectedPlanId === p.id}
                          onChange={(e) => setSelectedPlanId(e.target.value)}
                          className="text-[#1F4E79] focus:ring-[#1F4E79]"
                        />
                        <div>
                          <div className="font-bold text-[#333333]">{p.name}</div>
                          <div className="text-[11px] text-[#4B6584]">{p.description}</div>
                        </div>
                      </div>
                      <div className="text-right font-bold text-[#1F4E79]">
                        <Money minor={p.price_minor} /> / {p.interval}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                <strong>Proration Notice:</strong> Prorated adjustments will be calculated and applied to the customer's next regular billing run.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPlanModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-bold text-[#4B6584] hover:bg-[#F5F5F5] rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#1F4E79] hover:bg-[#163a5c] rounded-xl disabled:opacity-50"
                >
                  {actionLoading ? 'Updating Plan...' : 'Apply Plan Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionDetailPage;
