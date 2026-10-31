import { useState } from 'react';
import { ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Money from '../ui/Money';
import LoadingSpinner from '../ui/LoadingSpinner';
import subscriptionService, { AVAILABLE_PLANS } from '../../services/subscription.service';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/formatters';
import { isMockApiEnabled } from '../../mocks/mockAdapter';

export const PlanChangeDialog = ({
  isOpen,
  onClose,
  subscription,
  onSuccess,
}) => {
  const toast = useToast();
  const [selectedPlanId, setSelectedPlanId] = useState(
    AVAILABLE_PLANS[2].id // default to next tier
  );
  const [timing, setTiming] = useState('immediate'); // 'immediate' | 'at_renewal'
  const [preview, setPreview] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState(null);

  const fetchPreview = async (planId, selectedTiming) => {
    setIsPreviewLoading(true);
    setError(null);
    try {
      const data = await subscriptionService.previewPlanChange(subscription.id, {
        new_plan_id: planId,
        timing: selectedTiming,
      });
      setPreview(data);
    } catch (err) {
      setError(err.userMessage || 'Unable to calculate plan change preview.');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleSelectPlan = (planId) => {
    setSelectedPlanId(planId);
    fetchPreview(planId, timing);
  };

  const handleTimingChange = (newTiming) => {
    setTiming(newTiming);
    fetchPreview(selectedPlanId, newTiming);
  };

  const handleApply = async () => {
    setIsApplying(true);
    setError(null);
    try {
      const res = await subscriptionService.applyPlanChange(subscription.id, {
        new_plan_id: selectedPlanId,
        timing,
      });
      toast.success(
        res.is_simulated
          ? '[Simulated] Plan updated successfully in Mock Mode. Subscription updated locally.'
          : res.message || 'Plan updated successfully!'
      );
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.userMessage || 'Failed to apply plan change. Please try again.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Upgrade or Change Plan"
      subtitle={`Modify subscription ${subscription?.subscription_number}`}
      maxWidth="max-w-xl"
    >
      <div className="space-y-5">
        {error && (
          <div className="p-3 bg-[#FFEBEE] border border-[#FF6F61]/30 rounded-lg text-xs text-[#FF6F61] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Mock Mode Simulation Notice */}
        {isMockApiEnabled() && (
          <div className="p-3 bg-[#E3F2FD] border border-[#1E88E5]/30 rounded-lg flex items-center gap-2 text-xs text-[#1F4E79]">
            <ShieldCheck className="w-4 h-4 text-[#00796B] shrink-0" />
            <span>
              <strong>Simulated Plan Change (Mock Mode):</strong> No charges will occur. The subscription tier will update locally.
            </span>
          </div>
        )}

        {/* 1. Plan Selection */}
        <div>
          <label className="block text-xs font-bold text-[#333333] uppercase tracking-wider mb-2">
            Select New Subscription Plan
          </label>
          <div className="space-y-2">
            {AVAILABLE_PLANS.map((plan) => {
              const isCurrent = plan.name === subscription.plan_name;
              const isSelected = plan.id === selectedPlanId;

              return (
                <div
                  key={plan.id}
                  onClick={() => !isCurrent && handleSelectPlan(plan.id)}
                  className={`
                    p-3.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between
                    ${
                      isCurrent
                        ? 'bg-[#F5F5F5] border-[#4B6584]/20 opacity-60 cursor-not-allowed'
                        : isSelected
                        ? 'border-[#1F4E79] bg-[#E3F2FD]/50 ring-2 ring-[#1F4E79]/20'
                        : 'border-[#4B6584]/20 hover:border-[#1F4E79] bg-white'
                    }
                  `}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-bold text-sm text-[#333333]">
                        {plan.name}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] uppercase font-bold bg-[#4B6584]/15 text-[#4B6584] px-2 py-0.5 rounded-full">
                          Current Plan
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#4B6584] mt-0.5">{plan.description}</p>
                  </div>

                  <div className="text-right shrink-0 ml-3">
                    <Money
                      amountMinor={plan.price_minor}
                      currency={subscription.currency}
                      className="text-sm font-bold text-[#1F4E79]"
                    />
                    <span className="text-[10px] text-[#4B6584] block capitalize">
                      per {plan.frequency}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Timing Selection */}
        <div>
          <label className="block text-xs font-bold text-[#333333] uppercase tracking-wider mb-2">
            Effective Change Timing
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleTimingChange('immediate')}
              className={`p-3 rounded-lg border text-left text-xs transition-all ${
                timing === 'immediate'
                  ? 'border-[#00796B] bg-[#E0F2F1] text-[#005B51] font-semibold'
                  : 'border-[#4B6584]/20 bg-white text-[#4B6584] hover:bg-[#F5F5F5]'
              }`}
            >
              <div className="font-bold text-[#333333]">Immediate (Prorated)</div>
              <div className="text-[11px] mt-0.5">Activate today; credit old plan and charge difference.</div>
            </button>

            <button
              type="button"
              onClick={() => handleTimingChange('at_renewal')}
              className={`p-3 rounded-lg border text-left text-xs transition-all ${
                timing === 'at_renewal'
                  ? 'border-[#00796B] bg-[#E0F2F1] text-[#005B51] font-semibold'
                  : 'border-[#4B6584]/20 bg-white text-[#4B6584] hover:bg-[#F5F5F5]'
              }`}
            >
              <div className="font-bold text-[#333333]">At Next Renewal</div>
              <div className="text-[11px] mt-0.5">
                Takes effect on {formatDate(subscription.next_billing_date)}. No mid-cycle charge.
              </div>
            </button>
          </div>
        </div>

        {/* 3. Financial Proration Preview Breakdown */}
        <div className="p-4 bg-[#F5F5F5] rounded-xl border border-[#4B6584]/20">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#4B6584]/15">
            <span className="text-xs font-bold text-[#333333] uppercase tracking-wider">
              Financial Proration Breakdown
            </span>
            {isPreviewLoading && <LoadingSpinner size="sm" color="#1F4E79" />}
          </div>

          {preview?.breakdown ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-[#4B6584]">
                <span>Unused days credit ({preview.remaining_days} days):</span>
                <span className="font-semibold text-[#00796B]">
                  -<Money amountMinor={preview.breakdown.old_plan_credit_minor} currency={subscription.currency} />
                </span>
              </div>

              <div className="flex justify-between text-[#4B6584]">
                <span>Prorated charge for new plan ({preview.remaining_days} days):</span>
                <Money amountMinor={preview.breakdown.new_plan_prorated_charge_minor} currency={subscription.currency} />
              </div>

              <div className="flex justify-between text-[#4B6584]">
                <span>GST Tax (18% on prorated adjustment):</span>
                <Money amountMinor={preview.breakdown.tax_minor} currency={subscription.currency} />
              </div>

              <div className="pt-2 border-t border-[#4B6584]/20 flex justify-between font-bold text-sm text-[#1F4E79]">
                <span>Net Payable Today:</span>
                <Money
                  amountMinor={preview.breakdown.net_payable_minor}
                  currency={subscription.currency}
                  className="text-base text-[#1F4E79]"
                />
              </div>

              <p className="text-[11px] text-[#4B6584] italic pt-1">
                Effective date: {formatDate(preview.effective_date)}
              </p>
            </div>
          ) : (
            <div className="text-xs text-[#4B6584] text-center py-3">
              Calculating real-time proration schedule...
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" size="md" onClick={onClose} disabled={isApplying}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={handleApply}
            isLoading={isApplying}
            disabled={!preview}
            icon={<ArrowRight className="w-4 h-4" />}
            iconPosition="right"
          >
            Confirm & Apply Change
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default PlanChangeDialog;
