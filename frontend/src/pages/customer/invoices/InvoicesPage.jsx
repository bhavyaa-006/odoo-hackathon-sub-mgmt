import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Receipt, RefreshCw, X, AlertTriangle } from 'lucide-react';
import invoiceService from '../../../services/invoice.service';
import StatusBadge from '../../../components/ui/StatusBadge';
import Money from '../../../components/ui/Money';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import EmptyState from '../../../components/ui/EmptyState';
import Button from '../../../components/ui/Button';
import InvoiceCard from '../../../components/customer/InvoiceCard';
import PaymentDialog from '../../../components/customer/PaymentDialog';
import { formatDate } from '../../../utils/formatters';

export const InvoicesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentStatus = searchParams.get('status') || 'all';
  const searchQuery = searchParams.get('search') || '';

  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchInput, setSearchInput] = useState(searchQuery);

  // Pay Now dialog state
  const [payingInvoice, setPayingInvoice] = useState(null);

  const fetchInvoices = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await invoiceService.getInvoices({
        status: currentStatus,
        search: searchQuery,
      });
      setInvoices(data || []);
    } catch (err) {
      setError(err.userMessage || 'Failed to retrieve invoices.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const data = await invoiceService.getInvoices({
          status: currentStatus,
          search: searchQuery,
        });
        if (isMounted) {
          setInvoices(data || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.userMessage || 'Failed to retrieve invoices.');
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
    { value: 'all', label: 'All Invoices' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'confirmed', label: 'Unpaid / Open' },
    { value: 'paid', label: 'Paid' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-extrabold text-2xl text-[#1F4E79] tracking-tight">
            My Invoices
          </h1>
          <p className="text-xs text-[#4B6584] mt-0.5">
            Track recurring billings, download GST invoices, and settle balances
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchInvoices}
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
          <Button variant="danger" size="sm" onClick={fetchInvoices}>
            Retry
          </Button>
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-[#4B6584]/20 p-4 shadow-card flex flex-col md:flex-row items-center justify-between gap-3">
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

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-72">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-[#4B6584] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search invoice number..."
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

      {/* Invoice List */}
      {isLoading ? (
        <TableSkeleton rows={4} cols={7} />
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No invoices found."
          description="Invoices are generated automatically as recurring subscription cycles mature."
        />
      ) : (
        <>
          {/* Mobile view */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {invoices.map((inv) => (
              <InvoiceCard
                key={inv.id}
                invoice={inv}
                onPayNow={(target) => setPayingInvoice(target)}
              />
            ))}
          </div>

          {/* Desktop view */}
          <div className="hidden md:block bg-white rounded-xl border border-[#4B6584]/20 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F5F5F5] border-b border-[#4B6584]/20 text-[#333333]">
                    <th className="py-3 px-4 font-bold">Invoice #</th>
                    <th className="py-3 px-3 font-bold">Issued</th>
                    <th className="py-3 px-3 font-bold">Due Date</th>
                    <th className="py-3 px-3 font-bold">Status</th>
                    <th className="py-3 px-4 text-right font-bold">Total</th>
                    <th className="py-3 px-4 text-right font-bold">Paid</th>
                    <th className="py-3 px-4 text-right font-bold">Balance</th>
                    <th className="py-3 px-4 text-center font-bold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#4B6584]/10">
                  {invoices.map((inv) => {
                    const isPayable =
                      (inv.status === 'confirmed' || inv.status === 'overdue' || inv.status === 'partially_paid') &&
                      inv.outstanding_minor > 0;

                    return (
                      <tr
                        key={inv.id}
                        className="hover:bg-[#E3F2FD]/20 transition-colors group"
                      >
                        <td className="py-3.5 px-4 font-mono font-medium text-[#1F4E79]">
                          {inv.invoice_number}
                        </td>
                        <td className="py-3.5 px-3 text-[#4B6584]">
                          {formatDate(inv.issue_date)}
                        </td>
                        <td className="py-3.5 px-3 text-[#333333]">
                          {formatDate(inv.due_date)}
                        </td>
                        <td className="py-3.5 px-3">
                          <StatusBadge status={inv.status} type="invoice" />
                        </td>
                        <td className="py-3.5 px-4 text-right font-semibold">
                          <Money amountMinor={inv.total_minor} currency={inv.currency} />
                        </td>
                        <td className="py-3.5 px-4 text-right text-[#00796B]">
                          <Money amountMinor={inv.paid_minor} currency={inv.currency} />
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Money
                            amountMinor={inv.outstanding_minor}
                            currency={inv.currency}
                            className={`font-bold ${
                              inv.outstanding_minor > 0 ? 'text-[#FF6F61]' : 'text-[#00796B]'
                            }`}
                          />
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Link
                              to={`/customer/invoices/${inv.id}`}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#1F4E79] hover:bg-[#E3F2FD] transition-colors"
                            >
                              View
                            </Link>
                            {isPayable && (
                              <button
                                onClick={() => setPayingInvoice(inv)}
                                className="px-3 py-1.5 rounded-lg bg-[#00796B] text-white text-xs font-semibold hover:bg-[#005B51] transition-colors shadow-xs"
                              >
                                Pay
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Pay Now Dialog */}
      {payingInvoice && (
        <PaymentDialog
          isOpen={Boolean(payingInvoice)}
          onClose={() => setPayingInvoice(null)}
          invoice={payingInvoice}
          onSuccess={fetchInvoices}
        />
      )}
    </div>
  );
};

export default InvoicesPage;
