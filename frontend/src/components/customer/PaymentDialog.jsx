import { useState } from 'react';
import { ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Money from '../ui/Money';
import invoiceService from '../../services/invoice.service';
import { useToast } from '../../hooks/useToast';
import { toMinorUnits } from '../../utils/formatters';
import { isMockApiEnabled } from '../../mocks/mockAdapter';

export const PaymentDialog = ({
  isOpen,
  onClose,
  invoice,
  onSuccess,
}) => {
  const toast = useToast();
  const maxPayableMajor = (invoice?.outstanding_minor / 100).toFixed(2);
  const [payAmountMajor, setPayAmountMajor] = useState(maxPayableMajor);
  const [paymentMethod, setPaymentMethod] = useState('UPI / NetBanking');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!invoice) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const enteredMinor = toMinorUnits(payAmountMajor);

    if (enteredMinor <= 0) {
      setError('Payment amount must be greater than zero.');
      return;
    }

    if (enteredMinor > invoice.outstanding_minor) {
      setError(`Payment cannot exceed the outstanding balance of ₹${maxPayableMajor}.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await invoiceService.payInvoice(invoice.id, {
        amount_minor: enteredMinor,
        payment_method: paymentMethod,
        reference: `PAY-${Date.now().toString().slice(-6)}`,
      });

      toast.success(
        res.is_simulated
          ? `[Simulated] Payment of ₹${payAmountMajor} recorded. Invoice updated locally.`
          : res.message || 'Payment recorded successfully!'
      );
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.userMessage || 'Payment processing failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settle Invoice Balance"
      subtitle={`Payment against ${invoice.invoice_number}`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-[#FFEBEE] border border-[#FF6F61]/30 rounded-lg text-xs text-[#FF6F61] flex items-center gap-2" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Mock Mode Simulation Notice */}
        {isMockApiEnabled() && (
          <div className="p-3 bg-[#E3F2FD] border border-[#1E88E5]/30 rounded-lg flex items-center gap-2 text-xs text-[#1F4E79]">
            <ShieldCheck className="w-4 h-4 text-[#00796B] shrink-0" />
            <span>
              <strong>Simulated Payment (Mock Mode):</strong> No real money will be transferred. The invoice balance and payment ledger will update locally.
            </span>
          </div>
        )}

        {/* Invoice Summary Box */}
        <div className="p-3.5 bg-[#F5F5F5] rounded-lg border border-[#4B6584]/20 space-y-1.5 text-xs">
          <div className="flex justify-between text-[#4B6584]">
            <span>Invoice Total:</span>
            <Money amountMinor={invoice.total_minor} currency={invoice.currency} />
          </div>
          <div className="flex justify-between text-[#4B6584]">
            <span>Already Settled:</span>
            <Money amountMinor={invoice.paid_minor} currency={invoice.currency} />
          </div>
          <div className="flex justify-between font-bold text-sm text-[#FF6F61] pt-1.5 border-t border-[#4B6584]/15">
            <span>Outstanding Balance:</span>
            <Money amountMinor={invoice.outstanding_minor} currency={invoice.currency} />
          </div>
        </div>

        {/* Payment Amount Input */}
        <div>
          <Input
            id="pay-amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            max={maxPayableMajor}
            label="Payment Amount (₹)"
            value={payAmountMajor}
            onChange={(e) => {
              setPayAmountMajor(e.target.value);
              if (error) setError(null);
            }}
            required
            helperText={`Enter full or partial payment amount up to ₹${maxPayableMajor}`}
          />
          <div className="flex gap-2 mt-1.5">
            <button
              type="button"
              onClick={() => setPayAmountMajor(maxPayableMajor)}
              className="text-[11px] font-semibold text-[#1E88E5] hover:underline"
            >
              Pay Full Balance (₹{maxPayableMajor})
            </button>
          </div>
        </div>

        {/* Payment Method Selector */}
        <div>
          <label className="block text-xs font-semibold text-[#333333] mb-1.5">
            Select Payment Method
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              'UPI / NetBanking',
              'Credit / Debit Card',
              'Corporate Bank NEFT',
              'Cheque / DD',
            ].map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setPaymentMethod(method)}
                className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                  paymentMethod === method
                    ? 'border-[#00796B] bg-[#E0F2F1] text-[#005B51] font-semibold ring-1 ring-[#00796B]'
                    : 'border-[#4B6584]/20 bg-white text-[#4B6584] hover:bg-[#F5F5F5]'
                }`}
              >
                {method}
              </button>
            ))}
          </div>
        </div>

        <div className="p-2.5 bg-[#E3F2FD] rounded-lg border border-[#B3D7F5] flex items-center gap-2 text-[11px] text-[#1F4E79]">
          <ShieldCheck className="w-4 h-4 text-[#00796B] shrink-0" />
          <span>Payment will be reconciled against invoice records immediately.</span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" size="md" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="secondary"
            size="md"
            isLoading={isSubmitting}
            icon={<ArrowRight className="w-4 h-4" />}
            iconPosition="right"
          >
            Submit Payment
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default PaymentDialog;
