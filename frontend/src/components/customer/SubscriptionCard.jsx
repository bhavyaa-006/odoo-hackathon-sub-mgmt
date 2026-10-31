import { Link } from 'react-router-dom';
import { ChevronRight, Calendar } from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';
import Money from '../ui/Money';
import { formatDate } from '../../utils/formatters';

export const SubscriptionCard = ({ subscription }) => {
  return (
    <div className="bg-white rounded-xl border border-[#4B6584]/20 p-5 shadow-card hover:shadow-elevated transition-all flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <span className="text-[11px] font-mono text-[#4B6584] font-medium tracking-tight">
              {subscription.subscription_number}
            </span>
            <h4 className="font-heading font-bold text-base text-[#1F4E79] line-clamp-1">
              {subscription.plan_name}
            </h4>
          </div>
          <StatusBadge status={subscription.status} type="subscription" />
        </div>

        <div className="text-xs text-[#4B6584] space-y-1.5 my-3 py-2.5 border-y border-[#4B6584]/10">
          <div className="flex items-center justify-between">
            <span>Billing frequency:</span>
            <span className="font-medium text-[#333333] capitalize">
              {subscription.billing_frequency}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#4B6584]" />
              <span>Next billing:</span>
            </span>
            <span className="font-medium text-[#333333]">
              {formatDate(subscription.next_billing_date)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div>
          <span className="text-[10px] text-[#4B6584] uppercase tracking-wider block">
            Recurring Amount
          </span>
          <Money
            amountMinor={subscription.amount_minor}
            currency={subscription.currency}
            className="text-base text-[#333333]"
          />
        </div>

        <Link
          to={`/customer/subscriptions/${subscription.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F4E79] hover:text-[#00796B] transition-colors bg-[#E3F2FD] px-3 py-1.5 rounded-lg"
        >
          <span>Details</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};

export default SubscriptionCard;
