import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileSpreadsheet, ChevronRight, AlertTriangle, RefreshCw } from 'lucide-react';
import quotationService from '../../../services/quotation.service';
import StatusBadge from '../../../components/ui/StatusBadge';
import Money from '../../../components/ui/Money';
import Button from '../../../components/ui/Button';
import EmptyState from '../../../components/ui/EmptyState';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { formatDate } from '../../../utils/formatters';

export const QuotationsPage = () => {
  const [quotations, setQuotations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchQuotations = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await quotationService.getQuotations();
      const enriched = (data || []).map((q) => ({
        ...q,
        is_expiring_soon:
          q.status === 'pending' &&
          new Date(q.valid_until).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000,
      }));
      setQuotations(enriched);
    } catch (err) {
      setError(err.userMessage || 'Failed to retrieve quotations.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const data = await quotationService.getQuotations();
        const enriched = (data || []).map((q) => ({
          ...q,
          is_expiring_soon:
            q.status === 'pending' &&
            new Date(q.valid_until).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000,
        }));
        if (isMounted) {
          setQuotations(enriched);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.userMessage || 'Failed to retrieve quotations.');
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

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-extrabold text-2xl text-[#1F4E79] tracking-tight">
            My Quotations
          </h1>
          <p className="text-xs text-[#4B6584] mt-0.5">
            Review custom proposals and convert accepted quotes into active subscriptions
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchQuotations}
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
          <Button variant="danger" size="sm" onClick={fetchQuotations}>
            Retry
          </Button>
        </div>
      )}

      {isLoading ? (
        <TableSkeleton rows={3} cols={5} />
      ) : quotations.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          title="No quotations currently on file."
          description="When our enterprise team creates a customized quotation or proposal for your organization, it will appear here for your review and one-click acceptance."
        />
      ) : (
        <div className="bg-white rounded-xl border border-[#4B6584]/20 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F5F5F5] border-b border-[#4B6584]/20 text-[#333333]">
                  <th className="py-3 px-4 font-bold">Quotation #</th>
                  <th className="py-3 px-4 font-bold">Proposal Plan</th>
                  <th className="py-3 px-3 font-bold">Issued Date</th>
                  <th className="py-3 px-3 font-bold">Valid Until</th>
                  <th className="py-3 px-3 font-bold">Status</th>
                  <th className="py-3 px-4 text-right font-bold">Proposed Total</th>
                  <th className="py-3 px-4 text-center font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#4B6584]/10">
                {quotations.map((q) => {
                  const isExpiringSoon = q.is_expiring_soon;

                  return (
                    <tr key={q.id} className="hover:bg-[#E3F2FD]/20 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-[#1F4E79]">
                        {q.quotation_number}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[#333333]">
                        {q.plan_name}
                      </td>
                      <td className="py-3.5 px-3 text-[#4B6584]">
                        {formatDate(q.created_date)}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className={isExpiringSoon ? 'text-[#FF6F61] font-bold flex items-center gap-1' : 'text-[#333333]'}>
                          {isExpiringSoon && <AlertTriangle className="w-3.5 h-3.5" />}
                          {formatDate(q.valid_until)}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <StatusBadge status={q.status} type="quotation" />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Money
                          amountMinor={q.total_minor}
                          currency={q.currency}
                          className="font-bold text-sm text-[#333333]"
                        />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Link
                          to={`/customer/quotations/${q.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#E3F2FD] text-[#1F4E79] font-semibold text-xs hover:bg-[#1F4E79] hover:text-white transition-colors"
                        >
                          <span>Review</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuotationsPage;
