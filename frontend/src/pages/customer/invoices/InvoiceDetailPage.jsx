import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Printer,
  CreditCard,
  AlertTriangle,
} from 'lucide-react';
import invoiceService from '../../../services/invoice.service';
import StatusBadge from '../../../components/ui/StatusBadge';
import Money from '../../../components/ui/Money';
import Button from '../../../components/ui/Button';
import PaymentDialog from '../../../components/customer/PaymentDialog';
import InvoicePrintView from '../../../components/customer/InvoicePrintView';
import { CardSkeleton, TableSkeleton } from '../../../components/ui/Skeleton';
import { formatDate, formatDateTime } from '../../../utils/formatters';

export const InvoiceDetailPage = () => {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isNotFound, setIsNotFound] = useState(false);

  // States for print view and pay dialog
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const fetchInvoice = async () => {
    setIsLoading(true);
    setError(null);
    setIsNotFound(false);
    try {
      const data = await invoiceService.getInvoice(id);
      setInvoice(data);
    } catch (err) {
      if (err.response?.status === 404) {
        setIsNotFound(true);
      } else {
        setError(err.userMessage || 'Failed to load invoice details.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const data = await invoiceService.getInvoice(id);
        if (isMounted) {
          setInvoice(data);
        }
      } catch (err) {
        if (isMounted) {
          if (err.response?.status === 404) {
            setIsNotFound(true);
          } else {
            setError(err.userMessage || 'Failed to load invoice details.');
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

  if (isNotFound) {
    return (
      <div className="bg-white rounded-xl border border-[#4B6584]/20 p-12 text-center max-w-lg mx-auto my-8">
        <AlertTriangle className="w-12 h-12 text-[#FF6F61] mx-auto mb-3" />
        <h2 className="font-heading font-extrabold text-xl text-[#333333] mb-2">
          Invoice Not Found
        </h2>
        <p className="text-xs text-[#4B6584] mb-6">
          The requested invoice record could not be found or belongs to another customer account.
        </p>
        <Link to="/customer/invoices">
          <Button variant="primary" size="md" icon={<ArrowLeft className="w-4 h-4" />}>
            Back to My Invoices
          </Button>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <TableSkeleton rows={3} cols={6} />
      </div>
    );
  }

  if (!invoice) return null;

  if (isPrintMode) {
    return (
      <InvoicePrintView
        invoice={invoice}
        onBack={() => setIsPrintMode(false)}
      />
    );
  }

  const isPayable =
    (invoice.status === 'confirmed' || invoice.status === 'overdue' || invoice.status === 'partially_paid') &&
    invoice.outstanding_minor > 0;

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        to="/customer/invoices"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4B6584] hover:text-[#1F4E79] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to My Invoices</span>
      </Link>

      {error && (
        <div className="p-4 bg-[#FFEBEE] border border-[#FF6F61]/40 rounded-xl flex items-center justify-between text-xs text-[#333333]">
          <div className="flex items-center gap-2 text-[#FF6F61] font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="danger" size="sm" onClick={fetchInvoice}>
            Retry
          </Button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-[#4B6584]/20 p-6 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-mono text-xs font-bold text-[#4B6584]">
              {invoice.invoice_number}
            </span>
            <StatusBadge status={invoice.status} type="invoice" />
          </div>
          <h1 className="font-heading font-extrabold text-2xl text-[#1F4E79] tracking-tight">
            Tax Invoice Statement
          </h1>
          <p className="text-xs text-[#4B6584] mt-0.5">
            Issued {formatDate(invoice.issue_date)} • Due{' '}
            <strong className={invoice.status === 'overdue' ? 'text-[#FF6F61]' : 'text-[#333333]'}>
              {formatDate(invoice.due_date)}
            </strong>
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPrintMode(true)}
            icon={<Printer className="w-4 h-4" />}
          >
            Printable Invoice
          </Button>

          {isPayable && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowPaymentModal(true)}
              icon={<CreditCard className="w-4 h-4" />}
              iconPosition="left"
            >
              Pay Now (<Money amountMinor={invoice.outstanding_minor} currency={invoice.currency} />)
            </Button>
          )}
        </div>
      </div>

      {/* Parties: Billed To & Supplier Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[#4B6584]/20 p-5 shadow-card text-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#4B6584] block mb-2">
            Customer / Billed To
          </span>
          <p className="font-bold text-sm text-[#333333]">{invoice.customer?.name}</p>
          <p className="font-medium text-[#4B6584]">{invoice.customer?.company_name}</p>
          <p className="text-[#4B6584] mt-1">{invoice.customer?.billing_address}</p>
          {invoice.customer?.gstin && (
            <p className="text-[#4B6584] mt-1">
              Customer GSTIN: <strong className="text-[#333333] font-mono">{invoice.customer.gstin}</strong>
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-[#4B6584]/20 p-5 shadow-card text-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#4B6584] block mb-2">
            Supplier Details
          </span>
          <p className="font-bold text-sm text-[#333333]">{invoice.supplier?.name || 'Brightloop Software Solutions Pvt Ltd'}</p>
          <p className="text-[#4B6584]">{invoice.supplier?.address || 'Bengaluru, Karnataka'}</p>
          <p className="text-[#4B6584] mt-1">
            Supplier GSTIN: <strong className="text-[#333333] font-mono">{invoice.supplier?.gstin || '29AABCB1234C1Z1'}</strong>
          </p>
          <p className="text-[#4B6584]">
            HSN/SAC: <strong className="text-[#333333] font-mono">{invoice.supplier?.hsn_sac || '998313'}</strong>
          </p>
        </div>
      </div>

      {/* Invoice Lines Table */}
      <section className="bg-white rounded-xl border border-[#4B6584]/20 shadow-card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#4B6584]/15 bg-[#F5F5F5]/60 flex items-center justify-between">
          <h3 className="font-heading font-bold text-base text-[#1F4E79]">
            Invoice Line Items
          </h3>
          <span className="text-xs text-[#4B6584]">
            Billing Period: {invoice.billing_period}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#4B6584]/20 bg-[#F5F5F5] text-[#333333]">
                <th className="py-3 px-4 font-bold">Item Description</th>
                <th className="py-3 px-2 font-bold">HSN/SAC</th>
                <th className="py-3 px-2 text-right font-bold">Qty</th>
                <th className="py-3 px-3 text-right font-bold">Unit Price</th>
                <th className="py-3 px-3 text-right font-bold">Taxable Amount</th>
                <th className="py-3 px-3 text-right font-bold">Tax Rate</th>
                <th className="py-3 px-4 text-right font-bold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#4B6584]/10">
              {invoice.lines?.map((line, idx) => (
                <tr key={idx} className="hover:bg-[#E3F2FD]/20 transition-colors">
                  <td className="py-3.5 px-4">
                    <p className="font-bold text-[#333333] text-sm">{line.product}</p>
                    <p className="text-[11px] text-[#4B6584] mt-0.5">{line.description}</p>
                  </td>
                  <td className="py-3.5 px-2 text-[#4B6584] font-mono">{line.hsn_sac || '998313'}</td>
                  <td className="py-3.5 px-2 text-right font-medium">{line.quantity}</td>
                  <td className="py-3.5 px-3 text-right">
                    <Money amountMinor={line.unit_price_minor} currency={invoice.currency} />
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <Money amountMinor={line.taxable_amount_minor} currency={invoice.currency} />
                  </td>
                  <td className="py-3.5 px-3 text-right text-[#4B6584]">
                    {line.tax_rate || '18%'}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-[#333333]">
                    <Money amountMinor={line.line_total_minor} currency={invoice.currency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Financial Summary */}
        <div className="flex justify-end p-6 border-t border-[#4B6584]/15 bg-[#F5F5F5]/40 text-xs">
          <div className="w-72 space-y-2">
            <div className="flex justify-between text-[#4B6584]">
              <span>Subtotal:</span>
              <Money amountMinor={invoice.subtotal_minor} currency={invoice.currency} />
            </div>
            {invoice.discount_minor > 0 && (
              <div className="flex justify-between text-[#00796B]">
                <span>Discount:</span>
                <span>-<Money amountMinor={invoice.discount_minor} currency={invoice.currency} /></span>
              </div>
            )}
            <div className="flex justify-between text-[#4B6584]">
              <span>CGST (9%):</span>
              <Money amountMinor={Math.round(invoice.tax_minor / 2)} currency={invoice.currency} />
            </div>
            <div className="flex justify-between text-[#4B6584]">
              <span>SGST (9%):</span>
              <Money amountMinor={Math.round(invoice.tax_minor / 2)} currency={invoice.currency} />
            </div>
            <div className="flex justify-between font-bold text-base text-[#1F4E79] pt-2 border-t border-[#4B6584]/20">
              <span>Grand Total:</span>
              <Money
                amountMinor={invoice.total_minor}
                currency={invoice.currency}
                className="text-lg text-[#1F4E79]"
              />
            </div>
            <div className="flex justify-between text-[#00796B] font-semibold">
              <span>Paid to Date:</span>
              <Money amountMinor={invoice.paid_minor} currency={invoice.currency} />
            </div>
            <div className="flex justify-between font-bold text-sm text-[#FF6F61] pt-1.5 border-t border-[#4B6584]/15">
              <span>Outstanding Balance:</span>
              <Money
                amountMinor={invoice.outstanding_minor}
                currency={invoice.currency}
                className={invoice.outstanding_minor > 0 ? 'text-[#FF6F61]' : 'text-[#00796B]'}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Payment History Recorded */}
      <section className="bg-white rounded-xl border border-[#4B6584]/20 p-6 shadow-card">
        <h3 className="font-heading font-bold text-base text-[#1F4E79] mb-4 pb-2 border-b border-[#4B6584]/15 flex items-center justify-between">
          <span>Payment History</span>
          <span className="text-xs font-normal text-[#4B6584]">
            {invoice.payments?.length || 0} transaction records
          </span>
        </h3>

        {invoice.payments?.length === 0 ? (
          <p className="text-xs text-[#4B6584] italic">
            No payments have been recorded against this invoice yet.
          </p>
        ) : (
          <div className="space-y-2">
            {invoice.payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 rounded-lg bg-[#F5F5F5] border border-[#4B6584]/15 text-xs"
              >
                <div>
                  <span className="font-bold text-[#333333] block">
                    {p.payment_method}
                  </span>
                  <span className="text-[11px] text-[#4B6584]">
                    Reference: <strong className="font-mono text-[#333333]">{p.reference}</strong> • {formatDateTime(p.payment_date)}
                  </span>
                </div>
                <div className="text-right">
                  <Money
                    amountMinor={p.amount_minor}
                    currency={invoice.currency}
                    className="font-bold text-sm text-[#00796B]"
                  />
                  <span className="text-[10px] uppercase font-bold text-[#00796B] block">
                    {p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pay Now Modal */}
      {showPaymentModal && (
        <PaymentDialog
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          invoice={invoice}
          onSuccess={fetchInvoice}
        />
      )}
    </div>
  );
};

export default InvoiceDetailPage;
