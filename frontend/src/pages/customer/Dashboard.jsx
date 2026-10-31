import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  CreditCard,
  Calendar,
  FileSpreadsheet,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import customerService from '../../services/customer.service';
import subscriptionService from '../../services/subscription.service';
import invoiceService from '../../services/invoice.service';
import DashboardStatCard from '../../components/customer/DashboardStatCard';
import SubscriptionCard from '../../components/customer/SubscriptionCard';
import InvoiceCard from '../../components/customer/InvoiceCard';
import PaymentDialog from '../../components/customer/PaymentDialog';
import { CardSkeleton } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import Money from '../../components/ui/Money';
import { formatDate } from '../../utils/formatters';

export const CustomerDashboard = () => {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Payment modal state
  const [payingInvoice, setPayingInvoice] = useState(null);

  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [overviewData, subsData, invsData] = await Promise.all([
        customerService.getOverview(),
        subscriptionService.getSubscriptions(),
        invoiceService.getInvoices(),
      ]);
      setOverview(overviewData);
      setSubscriptions(subsData || []);
      setInvoices(invsData || []);
    } catch (err) {
      setError(err.userMessage || 'Failed to load dashboard metrics. Please retry.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const [overviewData, subsData, invsData] = await Promise.all([
          customerService.getOverview(),
          subscriptionService.getSubscriptions(),
          invoiceService.getInvoices(),
        ]);
        if (isMounted) {
          setOverview(overviewData);
          setSubscriptions(subsData || []);
          setInvoices(invsData || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.userMessage || 'Failed to load dashboard metrics. Please retry.');
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
  }, []);

  const activeSubscriptions = subscriptions.filter((s) => s.status === 'active');
  const overdueInvoices = invoices.filter((i) => i.status === 'overdue' && i.outstanding_minor > 0);

  return (
    <div className="space-y-8">
      {/* 7.1 Welcome Banner */}
      <div className="bg-white rounded-xl border border-[#4B6584]/20 p-6 sm:p-8 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E0F2F1] text-[#00796B] mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Verified Customer Session
          </div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#1F4E79] tracking-tight">
            Welcome back, {user?.name || 'Customer'}
          </h1>
          <p className="text-sm font-sans text-[#4B6584] mt-1">
            Here's an overview of your subscriptions and billing activity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboardData}
            isLoading={isLoading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Global Error Banner with Retry */}
      {error && (
        <div className="p-4 bg-[#FFEBEE] border border-[#FF6F61]/40 rounded-xl flex items-center justify-between text-xs text-[#333333]">
          <div className="flex items-center gap-2 text-[#FF6F61] font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="danger" size="sm" onClick={loadDashboardData}>
            Retry
          </Button>
        </div>
      )}

      {/* 7.6 Important Notices (e.g. Overdue Invoices) */}
      {overdueInvoices.length > 0 && (
        <div className="p-4 bg-[#FFEBEE] border border-[#FF6F61]/30 rounded-xl flex items-start gap-3 text-xs">
          <AlertTriangle className="w-5 h-5 text-[#FF6F61] shrink-0 mt-0.5" />
          <div className="grow">
            <p className="font-bold text-[#FF6F61]">
              Attention: You have {overdueInvoices.length} overdue invoice requiring settlement.
            </p>
            <p className="text-[#333333] mt-0.5">
              Invoice <strong className="font-mono">{overdueInvoices[0].invoice_number}</strong> has an outstanding balance of{' '}
              <Money amountMinor={overdueInvoices[0].outstanding_minor} currency={overdueInvoices[0].currency} className="font-bold text-[#FF6F61]" />.
            </p>
          </div>
          <button
            onClick={() => setPayingInvoice(overdueInvoices[0])}
            className="px-3 py-1.5 bg-[#FF6F61] text-white rounded-lg font-semibold hover:bg-[#E05345] transition-colors shrink-0"
          >
            Pay Now
          </button>
        </div>
      )}

      {/* 7.2 Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {isLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <DashboardStatCard
              title="Active Subscriptions"
              value={overview?.active_subscriptions ?? activeSubscriptions.length}
              subtitle="Managed in real-time"
              icon={Layers}
              accent="navy"
              linkTo="/customer/subscriptions"
            />

            <DashboardStatCard
              title="Outstanding Balance"
              value={
                <Money
                  amountMinor={overview?.outstanding_balance_minor ?? 0}
                  currency={overview?.currency}
                />
              }
              subtitle="Payable across invoices"
              icon={CreditCard}
              accent={overview?.outstanding_balance_minor > 0 ? 'coral' : 'teal'}
              linkTo="/customer/invoices"
            />

            <DashboardStatCard
              title="Next Scheduled Billing"
              value={formatDate(overview?.next_invoice_date)}
              subtitle={
                overview?.estimated_next_invoice_minor ? (
                  <span>
                    Est.{' '}
                    <Money
                      amountMinor={overview.estimated_next_invoice_minor}
                      currency={overview?.currency}
                    />
                  </span>
                ) : (
                  'No upcoming renewal'
                )
              }
              icon={Calendar}
              accent="teal"
              linkTo="/customer/subscriptions"
            />

            <DashboardStatCard
              title="Pending Quotations"
              value={overview?.pending_quotations ?? 0}
              subtitle="Offers awaiting review"
              icon={FileSpreadsheet}
              accent="amber"
              linkTo="/customer/quotations"
            />
          </>
        )}
      </div>

      {/* 7.3 Active Subscriptions Overview */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading font-bold text-lg text-[#1F4E79]">
              Active Subscriptions
            </h2>
            <p className="text-xs text-[#4B6584]">
              Your active subscription contracts and billing terms
            </p>
          </div>
          <Link
            to="/customer/subscriptions"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E88E5] hover:text-[#1565C0]"
          >
            <span>View All ({subscriptions.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : subscriptions.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="You don't have any subscriptions yet."
            description="Explore our available quotation templates or contact sales to launch your subscription."
            actionLabel="View Quotations"
            actionPath="/customer/quotations"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {subscriptions.slice(0, 4).map((sub) => (
              <SubscriptionCard key={sub.id} subscription={sub} />
            ))}
          </div>
        )}
      </section>

      {/* 7.4 Recent Invoices Overview */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading font-bold text-lg text-[#1F4E79]">
              Recent Invoices
            </h2>
            <p className="text-xs text-[#4B6584]">
              Latest billing statements and payment records
            </p>
          </div>
          <Link
            to="/customer/invoices"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E88E5] hover:text-[#1565C0]"
          >
            <span>View All Invoices ({invoices.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No invoices generated yet."
            description="Recurring invoices will appear here as your active subscription billing cycles complete."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {invoices.slice(0, 4).map((inv) => (
              <InvoiceCard
                key={inv.id}
                invoice={inv}
                onPayNow={(target) => setPayingInvoice(target)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Pay Now Dialog */}
      {payingInvoice && (
        <PaymentDialog
          isOpen={Boolean(payingInvoice)}
          onClose={() => setPayingInvoice(null)}
          invoice={payingInvoice}
          onSuccess={loadDashboardData}
        />
      )}
    </div>
  );
};

export default CustomerDashboard;
