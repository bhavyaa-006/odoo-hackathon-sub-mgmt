import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Pause,
  Play,
  RotateCcw,
  XCircle,
  TrendingUp,
  AlertTriangle,
  History,
} from 'lucide-react';
import subscriptionService from '../../../services/subscription.service';
import StatusBadge from '../../../components/ui/StatusBadge';
import Money from '../../../components/ui/Money';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import PlanChangeDialog from '../../../components/customer/PlanChangeDialog';
import { CardSkeleton, TableSkeleton } from '../../../components/ui/Skeleton';
import { useToast } from '../../../hooks/useToast';
import { formatDate, formatDateTime } from '../../../utils/formatters';

export const SubscriptionDetailPage = () => {
  const { id } = useParams();
  const toast = useToast();

  const [subscription, setSubscription] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isNotFound, setIsNotFound] = useState(false);

  // Action Confirmation Modals State
  const [activeActionModal, setActiveActionModal] = useState(null); // 'pause' | 'resume' | 'cancel' | 'renew'
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);
  const [showPlanChangeModal, setShowPlanChangeModal] = useState(false);

  const fetchDetail = async () => {
    setIsLoading(true);
    setError(null);
    setIsNotFound(false);
    try {
      const data = await subscriptionService.getSubscription(id);
      setSubscription(data);
    } catch (err) {
      if (err.response?.status === 404) {
        setIsNotFound(true);
      } else {
        setError(err.userMessage || 'Unable to load subscription details.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const data = await subscriptionService.getSubscription(id);
        if (isMounted) {
          setSubscription(data);
        }
      } catch (err) {
        if (isMounted) {
          if (err.response?.status === 404) {
            setIsNotFound(true);
          } else {
            setError(err.userMessage || 'Unable to load subscription details.');
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleExecuteAction = async () => {
    if (!activeActionModal) return;
    setIsActionSubmitting(true);
    try {
      const res = await subscriptionService.performAction(id, activeActionModal);
      toast.success(
        res.is_simulated
          ? `[Simulated] Subscription ${activeActionModal} action applied in Mock Mode.`
          : res.message || `Action ${activeActionModal} executed successfully.`
      );
      setActiveActionModal(null);
      await fetchDetail();
    } catch (err) {
      toast.error(err.userMessage || `Failed to ${activeActionModal} subscription.`);
    } finally {
      setIsActionSubmitting(false);
    }
  };

  if (isNotFound) {
    return (
      <div className="bg-white rounded-xl border border-[#4B6584]/20 p-12 text-center max-w-lg mx-auto my-8">
        <AlertTriangle className="w-12 h-12 text-[#FF6F61] mx-auto mb-3" />
        <h2 className="font-heading font-extrabold text-xl text-[#333333] mb-2">
          Subscription Not Found
        </h2>
        <p className="text-xs text-[#4B6584] mb-6">
          The requested subscription record does not exist or belongs to another customer account.
        </p>
        <Link to="/customer/subscriptions">
          <Button variant="primary" size="md" icon={<ArrowLeft className="w-4 h-4" />}>
            Back to My Subscriptions
          </Button>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <TableSkeleton rows={3} cols={5} />
      </div>
    );
  }

  if (!subscription) return null;

  const allowedTransitions = subscription.allowed_transitions || [];
  const canPause = allowedTransitions.includes('pause');
  const canResume = allowedTransitions.includes('resume');
  const canCancel = allowedTransitions.includes('cancel');
  const canRenew = allowedTransitions.includes('renew');
  const canChangePlan = allowedTransitions.includes('change_plan') || subscription.status === 'active';

  return (
    <div className="space-y-6">
      {/* 9.1 Back Link & Header */}
      <div>
        <Link
          to="/customer/subscriptions"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4B6584] hover:text-[#1F4E79] mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to My Subscriptions</span>
        </Link>

        {error && (
          <div className="p-4 mb-4 bg-[#FFEBEE] border border-[#FF6F61]/40 rounded-xl flex items-center justify-between text-xs text-[#333333]">
            <div className="flex items-center gap-2 text-[#FF6F61] font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <Button variant="danger" size="sm" onClick={fetchDetail}>
              Retry
            </Button>
          </div>
        )}

        <div className="bg-white rounded-xl border border-[#4B6584]/20 p-6 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono text-xs font-bold text-[#4B6584]">
                {subscription.subscription_number}
              </span>
              <StatusBadge status={subscription.status} type="subscription" />
            </div>
            <h1 className="font-heading font-extrabold text-2xl text-[#1F4E79] tracking-tight">
              {subscription.plan_name}
            </h1>
            <p className="text-xs text-[#4B6584] mt-0.5">
              Started on {formatDate(subscription.start_date)}
              {subscription.expiry_date ? ` • Expires on ${formatDate(subscription.expiry_date)}` : ' • Indefinite Recurring Plan'}
            </p>
          </div>

          {/* 9.5 Available Actions Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {canChangePlan && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowPlanChangeModal(true)}
                icon={<TrendingUp className="w-3.5 h-3.5" />}
              >
                Change Plan
              </Button>
            )}

            {canPause && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveActionModal('pause')}
                icon={<Pause className="w-3.5 h-3.5" />}
              >
                Pause
              </Button>
            )}

            {canResume && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActiveActionModal('resume')}
                icon={<Play className="w-3.5 h-3.5" />}
              >
                Resume
              </Button>
            )}

            {canRenew && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActiveActionModal('renew')}
                icon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Renew Contract
              </Button>
            )}

            {canCancel && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setActiveActionModal('cancel')}
                icon={<XCircle className="w-3.5 h-3.5" />}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 9.2 Subscription Overview Metadata Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-[#4B6584]/20 p-4 shadow-card">
          <span className="text-[11px] font-bold text-[#4B6584] uppercase tracking-wider block">
            Billing Frequency
          </span>
          <span className="text-base font-bold text-[#333333] capitalize mt-1 block">
            {subscription.billing_frequency}
          </span>
          <span className="text-[11px] text-[#4B6584]">Recurring cycle</span>
        </div>

        <div className="bg-white rounded-xl border border-[#4B6584]/20 p-4 shadow-card">
          <span className="text-[11px] font-bold text-[#4B6584] uppercase tracking-wider block">
            Recurring Amount
          </span>
          <Money
            amountMinor={subscription.amount_minor}
            currency={subscription.currency}
            className="text-xl font-extrabold text-[#1F4E79] mt-1 block"
          />
          <span className="text-[11px] text-[#4B6584]">Per interval</span>
        </div>

        <div className="bg-white rounded-xl border border-[#4B6584]/20 p-4 shadow-card">
          <span className="text-[11px] font-bold text-[#4B6584] uppercase tracking-wider block">
            Next Scheduled Invoice
          </span>
          <span className="text-base font-bold text-[#333333] mt-1 block">
            {formatDate(subscription.next_billing_date)}
          </span>
          <span className="text-[11px] text-[#4B6584]">Automated generation</span>
        </div>

        <div className="bg-white rounded-xl border border-[#4B6584]/20 p-4 shadow-card">
          <span className="text-[11px] font-bold text-[#4B6584] uppercase tracking-wider block">
            Payment Terms
          </span>
          <span className="text-base font-bold text-[#333333] mt-1 block">
            {subscription.payment_terms || 'Immediate'}
          </span>
          <span className="text-[11px] text-[#4B6584]">Net terms policy</span>
        </div>
      </div>

      {/* 9.3 Subscription Lines Table */}
      <section className="bg-white rounded-xl border border-[#4B6584]/20 shadow-card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#4B6584]/15 bg-[#F5F5F5]/60 flex items-center justify-between">
          <h3 className="font-heading font-bold text-base text-[#1F4E79]">
            Subscription Line Items
          </h3>
          <span className="text-xs text-[#4B6584]">
            {subscription.lines?.length || 0} product lines active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#4B6584]/20 bg-[#F5F5F5] text-[#333333]">
                <th className="py-3 px-4 font-bold">Product & Description</th>
                <th className="py-3 px-3 font-bold">Variant</th>
                <th className="py-3 px-3 text-right font-bold">Qty</th>
                <th className="py-3 px-3 text-right font-bold">Unit Price</th>
                <th className="py-3 px-3 text-right font-bold">Tax (GST)</th>
                <th className="py-3 px-4 text-right font-bold">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#4B6584]/10">
              {subscription.lines?.map((line, idx) => (
                <tr key={idx} className="hover:bg-[#E3F2FD]/20 transition-colors">
                  <td className="py-3.5 px-4">
                    <p className="font-bold text-[#333333] text-sm">{line.product}</p>
                    <p className="text-[11px] text-[#4B6584] mt-0.5">{line.description}</p>
                  </td>
                  <td className="py-3.5 px-3 text-[#4B6584]">
                    {line.variant || 'Standard'}
                  </td>
                  <td className="py-3.5 px-3 text-right font-medium">
                    {line.quantity}
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <Money amountMinor={line.unit_price_minor} currency={subscription.currency} />
                  </td>
                  <td className="py-3.5 px-3 text-right text-[#4B6584]">
                    <Money amountMinor={line.tax_minor} currency={subscription.currency} />
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-[#333333]">
                    <Money amountMinor={line.line_total_minor} currency={subscription.currency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 9.4 Subscription History Timeline */}
      {subscription.history?.length > 0 && (
        <section className="bg-white rounded-xl border border-[#4B6584]/20 p-6 shadow-card">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#4B6584]/15">
            <History className="w-4 h-4 text-[#00796B]" />
            <h3 className="font-heading font-bold text-base text-[#1F4E79]">
              Subscription Lifecycle Timeline
            </h3>
          </div>

          <div className="space-y-4">
            {subscription.history.map((event, idx) => (
              <div key={idx} className="flex items-start gap-3 relative pb-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#1F4E79] mt-1 shrink-0 ring-4 ring-[#E3F2FD]" />
                <div className="grow">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="font-bold text-xs text-[#333333]">
                      {event.title}
                    </span>
                    <span className="text-[11px] text-[#4B6584]">
                      {formatDateTime(event.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-[#4B6584] mt-0.5">
                    {event.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Action Modals */}
      {/* 1. Pause Modal */}
      <Modal
        isOpen={activeActionModal === 'pause'}
        onClose={() => setActiveActionModal(null)}
        title="Pause Subscription?"
        subtitle={subscription.subscription_number}
      >
        <div className="space-y-4 text-xs">
          <p className="text-[#333333]">
            Pausing this subscription will temporarily suspend automated recurring billing starting from the next cycle. You can resume it at any time.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setActiveActionModal(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleExecuteAction}
              isLoading={isActionSubmitting}
            >
              Confirm Pause
            </Button>
          </div>
        </div>
      </Modal>

      {/* 2. Resume Modal */}
      <Modal
        isOpen={activeActionModal === 'resume'}
        onClose={() => setActiveActionModal(null)}
        title="Resume Subscription?"
        subtitle={subscription.subscription_number}
      >
        <div className="space-y-4 text-xs">
          <p className="text-[#333333]">
            Resuming this subscription will restore active status and reactivate automated recurring billing on your regular schedule.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setActiveActionModal(null)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExecuteAction}
              isLoading={isActionSubmitting}
            >
              Confirm Resume
            </Button>
          </div>
        </div>
      </Modal>

      {/* 3. Cancel Modal */}
      <Modal
        isOpen={activeActionModal === 'cancel'}
        onClose={() => setActiveActionModal(null)}
        title="Cancel Subscription?"
        subtitle={subscription.subscription_number}
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-[#FFEBEE] border border-[#FF6F61]/30 rounded-lg text-[#FF6F61]">
            <p className="font-bold">Warning: This action will close the subscription.</p>
            <p className="mt-0.5 text-[#333333]">
              Future automated billing will stop. Historical invoices and receipts remain preserved in your portal.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setActiveActionModal(null)}>
              Keep Subscription
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleExecuteAction}
              isLoading={isActionSubmitting}
            >
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Modal>

      {/* 4. Renew Modal */}
      <Modal
        isOpen={activeActionModal === 'renew'}
        onClose={() => setActiveActionModal(null)}
        title="Renew Subscription Contract?"
        subtitle={subscription.subscription_number}
      >
        <div className="space-y-4 text-xs">
          <p className="text-[#333333]">
            Renewing will extend the contract term for another full billing period under the current plan pricing.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setActiveActionModal(null)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExecuteAction}
              isLoading={isActionSubmitting}
            >
              Confirm Renewal
            </Button>
          </div>
        </div>
      </Modal>

      {/* Plan Change Modal */}
      {showPlanChangeModal && (
        <PlanChangeDialog
          isOpen={showPlanChangeModal}
          onClose={() => setShowPlanChangeModal(false)}
          subscription={subscription}
          onSuccess={fetchDetail}
        />
      )}
    </div>
  );
};

export default SubscriptionDetailPage;
