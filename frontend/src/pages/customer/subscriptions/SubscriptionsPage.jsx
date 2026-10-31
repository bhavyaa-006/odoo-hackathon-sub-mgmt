import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Layers, ChevronRight, RefreshCw, X, AlertTriangle } from 'lucide-react';
import subscriptionService from '../../../services/subscription.service';
import StatusBadge from '../../../components/ui/StatusBadge';
import Money from '../../../components/ui/Money';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import EmptyState from '../../../components/ui/EmptyState';
import Button from '../../../components/ui/Button';
import SubscriptionCard from '../../../components/customer/SubscriptionCard';
import { formatDate } from '../../../utils/formatters';

export const SubscriptionsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentStatus = searchParams.get('status') || 'all';
  const searchQuery = searchParams.get('search') || '';

  const [subscriptions, setSubscriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchInput, setSearchInput] = useState(searchQuery);

  const fetchSubscriptions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await subscriptionService.getSubscriptions({
        status: currentStatus,
        search: searchQuery,
      });
      setSubscriptions(data || []);
    } catch (err) {
      setError(err.userMessage || 'Failed to retrieve subscriptions.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const data = await subscriptionService.getSubscriptions({
          status: currentStatus,
          search: searchQuery,
        });
        if (isMounted) {
          setSubscriptions(data || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.userMessage || 'Failed to retrieve subscriptions.');
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
  }, [currentStatus, searchQuery]);

  const handleFilterChange = (status) => {
    const params = new URLSearchParams(searchParams);
    if (status === 'all') {
      params.delete('status');
    } else {
      params.set('status', status);
    }
    setSearchParams(params);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (searchInput.trim()) {
      params.set('search', searchInput.trim());
    } else {
      params.delete('search');
    }
    setSearchParams(params);
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearchParams(new URLSearchParams());
  };

  const statusOptions = [
    { value: 'all', label: 'All Subscriptions' },
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'closed', label: 'Closed' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-extrabold text-2xl text-[#1F4E79] tracking-tight">
            My Subscriptions
          </h1>
          <p className="text-xs text-[#4B6584] mt-0.5">
            Monitor, pause, upgrade, or manage your recurring services
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchSubscriptions}
          isLoading={isLoading}
          icon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh
        </Button>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 bg-[#FFEBEE] border border-[#FF6F61]/40 rounded-xl flex items-center justify-between text-xs text-[#333333]">
          <div className="flex items-center gap-2 text-[#FF6F61] font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="danger" size="sm" onClick={fetchSubscriptions}>
            Retry
          </Button>
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div className="bg-white rounded-xl border border-[#4B6584]/20 p-4 shadow-card flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleFilterChange(opt.value)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors
                ${
                  currentStatus === opt.value
                    ? 'bg-[#1F4E79] text-white shadow-xs'
                    : 'bg-[#F5F5F5] text-[#4B6584] hover:bg-[#E3F2FD] hover:text-[#1F4E79]'
                }
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-72">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-[#4B6584] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by ID or plan..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full h-9 pl-9 pr-8 text-xs bg-[#F5F5F5] rounded-lg border border-[#4B6584]/20 focus:outline-none focus:border-[#1F4E79] focus:bg-white transition-colors"
            />
            {searchInput && (
              <button
                type="button"
                onClick={clearFilters}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4B6584] hover:text-[#333333]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Button type="submit" variant="primary" size="sm">
            Search
          </Button>
        </form>
      </div>

      {/* Main Subscriptions List / Table */}
      {isLoading ? (
        <TableSkeleton rows={4} cols={6} />
      ) : subscriptions.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="You don't have any subscriptions yet."
          description="Explore our available quotation templates or contact sales to launch your subscription."
          actionLabel="View Quotations"
          actionPath="/customer/quotations"
        />
      ) : (
        <>
          {/* Mobile Card Grid (hidden on md) */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {subscriptions.map((sub) => (
              <SubscriptionCard key={sub.id} subscription={sub} />
            ))}
          </div>

          {/* Desktop Table (hidden on small screens) */}
          <div className="hidden md:block bg-white rounded-xl border border-[#4B6584]/20 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F5F5F5] border-b border-[#4B6584]/20 text-[#333333]">
                    <th className="py-3 px-4 font-bold">Subscription #</th>
                    <th className="py-3 px-4 font-bold">Plan Name</th>
                    <th className="py-3 px-3 font-bold">Status</th>
                    <th className="py-3 px-3 font-bold">Frequency</th>
                    <th className="py-3 px-3 font-bold">Next Billing</th>
                    <th className="py-3 px-4 text-right font-bold">Recurring Amount</th>
                    <th className="py-3 px-4 text-center font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#4B6584]/10">
                  {subscriptions.map((sub) => (
                    <tr
                      key={sub.id}
                      className="hover:bg-[#E3F2FD]/30 transition-colors group"
                    >
                      <td className="py-3.5 px-4 font-mono font-medium text-[#1F4E79]">
                        {sub.subscription_number}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[#333333]">
                        {sub.plan_name}
                      </td>
                      <td className="py-3.5 px-3">
                        <StatusBadge status={sub.status} type="subscription" />
                      </td>
                      <td className="py-3.5 px-3 text-[#4B6584] capitalize">
                        {sub.billing_frequency}
                      </td>
                      <td className="py-3.5 px-3 text-[#333333]">
                        {formatDate(sub.next_billing_date)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Money
                          amountMinor={sub.amount_minor}
                          currency={sub.currency}
                          className="font-bold text-sm text-[#333333]"
                        />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Link
                          to={`/customer/subscriptions/${sub.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#E3F2FD] text-[#1F4E79] font-semibold text-xs hover:bg-[#1F4E79] hover:text-white transition-colors"
                        >
                          <span>Manage</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SubscriptionsPage;
