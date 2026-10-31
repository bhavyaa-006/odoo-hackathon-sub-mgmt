import { Printer, ArrowLeft } from 'lucide-react';
import BrandLogo from '../ui/BrandLogo';
import Money from '../ui/Money';
import { formatDate } from '../../utils/formatters';
import Button from '../ui/Button';

export const InvoicePrintView = ({ invoice, onBack }) => {
  if (!invoice) return null;

  return (
    <div className="bg-white rounded-xl border border-[#4B6584]/20 p-6 sm:p-10 shadow-card print:p-0 print:border-none print:shadow-none">
      {/* Print Controls Header - Hidden when printing */}
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-[#4B6584]/20 print:hidden">
        <Button variant="outline" size="sm" onClick={onBack} icon={<ArrowLeft className="w-4 h-4" />}>
          Back to Invoice Details
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => window.print()}
          icon={<Printer className="w-4 h-4" />}
          iconPosition="left"
        >
          Print Invoice
        </Button>
      </div>

      {/* Tax Invoice Document Container */}
      <div className="print-document text-[#333333]">
        {/* Document Header */}
        <div className="flex justify-between items-start pb-6 border-b border-[#4B6584]/20">
          <div>
            <BrandLogo size="default" clickable={false} />
            <p className="text-xs text-[#4B6584] mt-2 max-w-xs">
              {invoice.supplier?.address || 'Level 8, Tech Park, Indiranagar, Bengaluru, KA 560038'}
            </p>
            <p className="text-xs text-[#4B6584]">
              GSTIN: <strong className="text-[#333333]">{invoice.supplier?.gstin || '29AABCB1234C1Z1'}</strong>
            </p>
            <p className="text-xs text-[#4B6584]">
              HSN/SAC: <strong className="text-[#333333]">{invoice.supplier?.hsn_sac || '998313'}</strong>
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs font-bold uppercase tracking-wider text-[#00796B] bg-[#E0F2F1] px-3 py-1 rounded-full">
              Tax Invoice
            </span>
            <h2 className="text-2xl font-heading font-extrabold text-[#1F4E79] mt-2">
              {invoice.invoice_number}
            </h2>
            <div className="text-xs text-[#4B6584] mt-1 space-y-0.5">
              <div>Invoice Date: <strong className="text-[#333333]">{formatDate(invoice.issue_date)}</strong></div>
              <div>Due Date: <strong className="text-[#333333]">{formatDate(invoice.due_date)}</strong></div>
              <div>Status: <strong className="uppercase text-[#1F4E79]">{invoice.status}</strong></div>
            </div>
          </div>
        </div>

        {/* Billed To / Customer Details */}
        <div className="grid grid-cols-2 gap-8 py-6 border-b border-[#4B6584]/20 text-xs">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#4B6584] block mb-1">
              Billed To
            </span>
            <p className="font-bold text-sm text-[#333333]">{invoice.customer?.name}</p>
            {invoice.customer?.company_name && (
              <p className="font-medium text-[#4B6584]">{invoice.customer.company_name}</p>
            )}
            <p className="text-[#4B6584] mt-1">{invoice.customer?.billing_address}</p>
            {invoice.customer?.gstin && (
              <p className="text-[#4B6584] mt-0.5">
                Customer GSTIN: <strong className="text-[#333333]">{invoice.customer.gstin}</strong>
              </p>
            )}
          </div>

          <div className="text-right">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#4B6584] block mb-1">
              Subscription Context
            </span>
            <p className="font-semibold text-[#333333]">{invoice.subscription_number}</p>
            <p className="text-[#4B6584] mt-1">Period: {invoice.billing_period}</p>
          </div>
        </div>

        {/* Invoice Line Items Table */}
        <div className="py-6">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#4B6584]/20 bg-[#F5F5F5]">
                <th className="py-2.5 px-3 font-bold text-[#333333]">Product / Service</th>
                <th className="py-2.5 px-2 font-bold text-[#333333]">HSN/SAC</th>
                <th className="py-2.5 px-2 text-right font-bold text-[#333333]">Qty</th>
                <th className="py-2.5 px-2 text-right font-bold text-[#333333]">Unit Price</th>
                <th className="py-2.5 px-2 text-right font-bold text-[#333333]">Tax (18%)</th>
                <th className="py-2.5 px-3 text-right font-bold text-[#333333]">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#4B6584]/10">
              {invoice.lines?.map((line, idx) => (
                <tr key={idx}>
                  <td className="py-3 px-3">
                    <p className="font-bold text-[#333333]">{line.product}</p>
                    <p className="text-[11px] text-[#4B6584]">{line.description}</p>
                  </td>
                  <td className="py-3 px-2 text-[#4B6584]">{line.hsn_sac || '998313'}</td>
                  <td className="py-3 px-2 text-right font-medium">{line.quantity}</td>
                  <td className="py-3 px-2 text-right">
                    <Money amountMinor={line.unit_price_minor} currency={invoice.currency} />
                  </td>
                  <td className="py-3 px-2 text-right text-[#4B6584]">
                    <Money amountMinor={line.tax_minor} currency={invoice.currency} />
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-[#333333]">
                    <Money amountMinor={line.line_total_minor} currency={invoice.currency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals & Tax Breakup */}
        <div className="flex justify-end pt-4 pb-6 border-t border-[#4B6584]/20 text-xs">
          <div className="w-72 space-y-2">
            <div className="flex justify-between text-[#4B6584]">
              <span>Subtotal:</span>
              <Money amountMinor={invoice.subtotal_minor} currency={invoice.currency} />
            </div>
            {invoice.discount_minor > 0 && (
              <div className="flex justify-between text-[#00796B]">
                <span>Discount Applied:</span>
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
            <div className="flex justify-between font-bold text-sm text-[#1F4E79] pt-2 border-t border-[#4B6584]/20">
              <span>Grand Total:</span>
              <Money amountMinor={invoice.total_minor} currency={invoice.currency} />
            </div>
            <div className="flex justify-between text-[#00796B] font-semibold">
              <span>Paid to Date:</span>
              <Money amountMinor={invoice.paid_minor} currency={invoice.currency} />
            </div>
            <div className="flex justify-between text-[#FF6F61] font-bold text-sm pt-1 border-t border-[#4B6584]/15">
              <span>Balance Due:</span>
              <Money amountMinor={invoice.outstanding_minor} currency={invoice.currency} />
            </div>
          </div>
        </div>

        {/* Payment History Recorded */}
        {invoice.payments?.length > 0 && (
          <div className="pt-6 border-t border-[#4B6584]/20 text-xs">
            <h4 className="font-bold uppercase tracking-wider text-[#333333] mb-2">
              Recorded Settlement History
            </h4>
            <div className="space-y-1 text-[#4B6584]">
              {invoice.payments.map((p, idx) => (
                <div key={idx} className="flex justify-between bg-[#F5F5F5] p-2 rounded">
                  <span>{formatDate(p.payment_date)} • {p.payment_method} (Ref: {p.reference})</span>
                  <Money amountMinor={p.amount_minor} currency={invoice.currency} className="text-[#00796B] font-semibold" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Note */}
        <div className="mt-8 pt-4 border-t border-[#4B6584]/15 text-center text-[10px] text-[#4B6584]">
          This is a computer-generated tax invoice issued by Brightloop Software Solutions.
        </div>
      </div>
    </div>
  );
};

export default InvoicePrintView;
