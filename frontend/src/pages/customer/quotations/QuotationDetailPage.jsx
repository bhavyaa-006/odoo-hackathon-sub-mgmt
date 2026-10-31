import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import quotationService from '../../../services/quotation.service';
import StatusBadge from '../../../components/ui/StatusBadge';
import Money from '../../../components/ui/Money';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import { CardSkeleton, TableSkeleton } from '../../../components/ui/Skeleton';
import { useToast } from '../../../hooks/useToast';
import { formatDate } from '../../../utils/formatters';

export const QuotationDetailPage = () => {
  const { id } = useParams();
  const toast = useToast();

  const [quotation, setQuotation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  // Accept Confirmation Modal
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);

  const fetchQuotation = async () => {
    setIsLoading(true);
    setError(null);
    setIsNotFound(false);
    try {
      const data = await quotationService.getQuotation(id);
      setQuotation(data);
      if (data?.valid_until) {
        setIsExpired(new Date(data.valid_until).getTime() < Date.now());
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setIsNotFound(true);
      } else {
        setError(err.userMessage || 'Failed to retrieve quotation details.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const data = await quotationService.getQuotation(id);
        if (isMounted) {
          setQuotation(data);
          if (data?.valid_until) {
            setIsExpired(new Date(data.valid_until).getTime() < Date.now());
          }
        }
      } catch (err) {
        if (isMounted) {
          if (err.response?.status === 404) {
            setIsNotFound(true);
          } else {
            setError(err.userMessage || 'Failed to retrieve quotation details.');
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

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      const res = await quotationService.acceptQuotation(id);
      toast.success(
        res.is_simulated
          ? '[Simulated] Quotation accepted in Mock Mode.'
          : res.message || 'Quotation accepted! Subscription created.'
      );
      setShowAcceptModal(false);
      await fetchQuotation();
    } catch (err) {
      toast.error(err.userMessage || 'Failed to accept quotation.');
    } finally {
      setIsAccepting(false);
    }
  };

  if (isNotFound) {
    return (
      <div className="bg-white rounded-xl border border-[#4B6584]/20 p-12 text-center max-w-lg mx-auto my-8">
        <AlertTriangle className="w-12 h-12 text-[#FF6F61] mx-auto mb-3" />
        <h2 className="font-heading font-extrabold text-xl text-[#333333] mb-2">
          Quotation Not Found
        </h2>
        <p className="text-xs text-[#4B6584] mb-6">
          The requested quotation could not be located or belongs to a different customer organization.
        </p>
        <Link to="/customer/quotations">
          <Button variant="primary" size="md" icon={<ArrowLeft className="w-4 h-4" />}>
            Back to My Quotations
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

  if (!quotation) return null;

  const isAccepted = quotation.status === 'accepted';
  const isEligibleToAccept = quotation.status === 'pending' && !isExpired;

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        to="/customer/quotations"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4B6584] hover:text-[#1F4E79] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to My Quotations</span>
      </Link>

      {error && (
        <div className="p-4 bg-[#FFEBEE] border border-[#FF6F61]/40 rounded-xl flex items-center justify-between text-xs text-[#333333]">
          <div className="flex items-center gap-2 text-[#FF6F61] font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="danger" size="sm" onClick={fetchQuotation}>
            Retry
          </Button>
        </div>
      )}

      {/* Header Card */}
      <div className="bg-white rounded-xl border border-[#4B6584]/20 p-6 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-mono text-xs font-bold text-[#4B6584]">
              {quotation.quotation_number}
            </span>
            <StatusBadge status={quotation.status} type="quotation" />
          </div>
          <h1 className="font-heading font-extrabold text-2xl text-[#1F4E79] tracking-tight">
            {quotation.plan_name}
          </h1>
          <p className="text-xs text-[#4B6584] mt-0.5">
            Issued on {formatDate(quotation.created_date)} • Valid until{' '}
            <strong className={isExpired && !isAccepted ? 'text-[#FF6F61]' : 'text-[#333333]'}>
              {formatDate(quotation.valid_until)}
            </strong>
          </p>
        </div>

        {/* Action Button */}
        <div>
          {isEligibleToAccept && (
            <Button
              variant="secondary"
              size="md"
              onClick={() => setShowAcceptModal(true)}
              icon={<CheckCircle2 className="w-4 h-4" />}
              iconPosition="left"
            >
              Accept Quotation
            </Button>
          )}

          {isAccepted && quotation.converted_subscription_id && (
            <Link to={`/customer/subscriptions/${quotation.converted_subscription_id}`}>
              <Button
                variant="primary"
                size="md"
                icon={<ArrowRight className="w-4 h-4" />}
                iconPosition="right"
              >
                View Converted Subscription
              </Button>
            </Link>
          )}

          {isExpired && !isAccepted && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFEBEE] text-[#FF6F61] text-xs font-semibold">
              <AlertTriangle className="w-4 h-4" />
              Expired on {formatDate(quotation.valid_until)}
            </span>
          )}
        </div>
      </div>

      {/* Product Lines Table */}
      <section className="bg-white rounded-xl border border-[#4B6584]/20 shadow-card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#4B6584]/15 bg-[#F5F5F5]/60 flex items-center justify-between">
          <h3 className="font-heading font-bold text-base text-[#1F4E79]">
            Proposed Services & Specifications
          </h3>
          <span className="text-xs text-[#4B6584]">
            {quotation.lines?.length || 0} line items
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#4B6584]/20 bg-[#F5F5F5] text-[#333333]">
                <th className="py-3 px-4 font-bold">Product Specification</th>
                <th className="py-3 px-3 text-right font-bold">Qty</th>
                <th className="py-3 px-3 text-right font-bold">Unit Price</th>
                <th className="py-3 px-3 text-right font-bold">Discount</th>
                <th className="py-3 px-3 text-right font-bold">Tax (GST)</th>
                <th className="py-3 px-4 text-right font-bold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#4B6584]/10">
              {quotation.lines?.map((line, idx) => (
                <tr key={idx} className="hover:bg-[#E3F2FD]/20 transition-colors">
                  <td className="py-3.5 px-4">
                    <p className="font-bold text-[#333333] text-sm">{line.product}</p>
                    <p className="text-[11px] text-[#4B6584] mt-0.5">{line.description}</p>
                  </td>
                  <td className="py-3.5 px-3 text-right font-medium">{line.quantity}</td>
                  <td className="py-3.5 px-3 text-right">
                    <Money amountMinor={line.unit_price_minor} currency={quotation.currency} />
                  </td>
                  <td className="py-3.5 px-3 text-right text-[#00796B]">
                    {line.discount_minor > 0 ? (
                      <span>-<Money amountMinor={line.discount_minor} currency={quotation.currency} /></span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-right text-[#4B6584]">
                    <Money amountMinor={line.tax_minor} currency={quotation.currency} />
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-[#333333]">
                    <Money amountMinor={line.line_total_minor} currency={quotation.currency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Cost Breakdown Summary */}
        <div className="flex justify-end p-6 border-t border-[#4B6584]/15 bg-[#F5F5F5]/40 text-xs">
          <div className="w-72 space-y-2">
            <div className="flex justify-between text-[#4B6584]">
              <span>Subtotal:</span>
              <Money amountMinor={quotation.subtotal_minor} currency={quotation.currency} />
            </div>
            {quotation.discount_minor > 0 && (
              <div className="flex justify-between text-[#00796B]">
                <span>Promotional Discount:</span>
                <span>-<Money amountMinor={quotation.discount_minor} currency={quotation.currency} /></span>
              </div>
            )}
            <div className="flex justify-between text-[#4B6584]">
              <span>Estimated Tax (18% GST):</span>
              <Money amountMinor={quotation.tax_minor} currency={quotation.currency} />
            </div>
            <div className="flex justify-between font-bold text-base text-[#1F4E79] pt-2 border-t border-[#4B6584]/20">
              <span>Proposed Total:</span>
              <Money
                amountMinor={quotation.total_minor}
                currency={quotation.currency}
                className="text-lg text-[#1F4E79]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showAcceptModal}
        onClose={() => setShowAcceptModal(false)}
        title="Accept Quotation & Launch Subscription?"
        subtitle={quotation.quotation_number}
      >
        <div className="space-y-4 text-xs">
          <p className="text-[#333333]">
            By accepting this quotation, you approve the activation of <strong>{quotation.plan_name}</strong> for a total recurring commitment of <Money amountMinor={quotation.total_minor} currency={quotation.currency} className="font-bold text-[#1F4E79]" />.
          </p>
          <div className="p-3 bg-[#E0F2F1] rounded-lg border border-[#00796B]/25 text-[#005B51]">
            <ShieldCheck className="w-4 h-4 inline mr-1" />
            An active subscription record will be initiated immediately.
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowAcceptModal(false)}>
              Review Later
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAccept}
              isLoading={isAccepting}
            >
              Confirm Acceptance
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default QuotationDetailPage;
