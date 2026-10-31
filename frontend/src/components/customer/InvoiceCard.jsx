import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';
import Money from '../ui/Money';
import { formatDate } from '../../utils/formatters';

export const InvoiceCard = ({ invoice, onPayNow }) => {
  const isPayable = (invoice.status === 'confirmed' || invoice.status === 'overdue' || invoice.status === 'partially_paid') && invoice.outstanding_minor > 0;

  return (
    <div className="bg-white rounded-xl border border-[#4B6584]/20 p-5 shadow-card hover:shadow-elevated transition-all flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <span className="text-[11px] font-mono text-[#4B6584] font-medium tracking-tight">
              {invoice.invoice_number}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-[#4B6584]">Due:</span>
              <span className="text-xs font-semibold text-[#333333]">
                {formatDate(invoice.due_date)}
              </span>
            </div>
          </div>
          <StatusBadge status={invoice.status} type="invoice" />
        </div>

        <div className="text-xs text-[#4B6584] space-y-1.5 my-3 py-2.5 border-y border-[#4B6584]/10">
          <div className="flex items-center justify-between">
            <span>Invoice Total:</span>
            <Money amountMinor={invoice.total_minor} currency={invoice.currency} />
          </div>
          <div className="flex items-center justify-between">
            <span>Amount Paid:</span>
            <Money amountMinor={invoice.paid_minor} currency={invoice.currency} />
          </div>
          <div className="flex items-center justify-between font-semibold">
            <span className={invoice.outstanding_minor > 0 ? 'text-[#FF6F61]' : 'text-[#00796B]'}>
              Outstanding Balance:
            </span>
            <Money
              amountMinor={invoice.outstanding_minor}
              currency={invoice.currency}
              className={invoice.outstanding_minor > 0 ? 'text-[#FF6F61]' : 'text-[#00796B]'}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <Link
          to={`/customer/invoices/${invoice.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#4B6584] hover:text-[#1F4E79] transition-colors"
        >
          <span>View Invoice</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>

        {isPayable && onPayNow && (
          <button
            onClick={() => onPayNow(invoice)}
            className="px-3 py-1.5 rounded-lg bg-[#00796B] text-white text-xs font-semibold hover:bg-[#005B51] transition-colors shadow-xs"
          >
            Pay Now
          </button>
        )}
      </div>
    </div>
  );
};

export default InvoiceCard;
