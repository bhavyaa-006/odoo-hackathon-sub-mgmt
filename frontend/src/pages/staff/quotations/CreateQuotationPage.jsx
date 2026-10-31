import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { quotationService } from '../../../services/quotation.service';
import { customerService } from '../../../services/customer.service';
import Money from '../../../components/ui/Money';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

export const CreateQuotationPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [customers, setCustomers] = useState([]);

  // Form State
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [title, setTitle] = useState('Enterprise Subscription Proposal');
  const [validUntil, setValidUntil] = useState('2026-11-30');
  const [discountRupees, setDiscountRupees] = useState(0);
  const [lines, setLines] = useState([
    {
      product_name: 'Brightloop Core Enterprise Engine',
      quantity: 1,
      unit_price_rupees: 12000,
      billing_interval: 'month',
    },
  ]);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchInit = async () => {
      try {
        setLoading(true);
        const [tplRes, custRes] = await Promise.all([
          quotationService.getQuotationTemplates(),
          customerService.getStaffCustomers(),
        ]);
        if (isMounted) {
          setTemplates(tplRes || []);
          setCustomers(custRes.customers || []);
          if (custRes.customers?.length > 0) {
            setCustomerId(custRes.customers[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to initialize quotation builder:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchInit();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleApplyTemplate = (templateId) => {
    setSelectedTemplateId(templateId);
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;

    setTitle(tpl.name);
    setDiscountRupees(Math.round((tpl.discount_minor || 0) / 100));
    if (tpl.lines && tpl.lines.length > 0) {
      setLines(
        tpl.lines.map((l) => ({
          product_name: l.product_name,
          quantity: l.quantity,
          unit_price_rupees: Math.round((l.unit_price_minor || 0) / 100),
          billing_interval: l.billing_interval || 'month',
        }))
      );
    }
  };

  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      {
        product_name: 'Subscription Add-on / Module',
        quantity: 1,
        unit_price_rupees: 2500,
        billing_interval: 'month',
      },
    ]);
  };

  const handleRemoveLine = (idx) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx, field, value) => {
    setLines((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  // Calculations in Minor Units
  const subtotalMinor = lines.reduce(
    (acc, l) => acc + Math.round(Number(l.unit_price_rupees || 0) * 100) * Number(l.quantity || 1),
    0
  );
  const discountMinor = Math.round(Number(discountRupees || 0) * 100);
  const taxableMinor = Math.max(0, subtotalMinor - discountMinor);
  const gstMinor = Math.round(taxableMinor * 0.18);
  const totalMinor = taxableMinor + gstMinor;

  const handleSubmit = async (targetStatus = 'draft') => {
    if (!customerId) {
      setNotice({ type: 'error', message: 'Please select a customer account.' });
      return;
    }
    if (lines.length === 0) {
      setNotice({ type: 'error', message: 'Quotation must have at least one line item.' });
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        customer_id: customerId,
        title,
        valid_until: validUntil,
        status: targetStatus,
        discount_minor: discountMinor,
        lines: lines.map((l) => ({
          product_name: l.product_name,
          quantity: Number(l.quantity),
          unit_price_minor: Math.round(Number(l.unit_price_rupees) * 100),
          billing_interval: l.billing_interval,
        })),
      };

      const res = await quotationService.createQuotation(payload);
      setNotice({
        type: 'success',
        message: `Quotation ${res.quotation?.quotation_number || ''} created successfully!`,
      });
      setTimeout(() => {
        navigate(`/staff/quotations/${res.quotation?.id || ''}`);
      }, 600);
    } catch (err) {
      setNotice({
        type: 'error',
        message: err.message || 'Failed to create quotation.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading templates and customer registry..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link
        to="/staff/quotations"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4B6584] hover:text-[#1F4E79] transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Quotations</span>
      </Link>

      {notice && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
            notice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{notice.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-heading text-[#1F4E79]">
            Create Subscription Quotation
          </h1>
          <p className="text-xs text-[#4B6584] mt-1">
            Author an itemized B2B proposal with Indian GST calculations and contract terms.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSubmit('draft')}
            className="px-4 py-2 border border-slate-300 hover:bg-[#F5F5F5] text-xs font-bold text-[#333333] rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            Save as Draft
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSubmit('quotation')}
            className="px-4 py-2 bg-[#1F4E79] hover:bg-[#163a5c] text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          >
            {submitting ? 'Generating...' : 'Send to Customer'}
          </button>
        </div>
      </div>

      {/* Template Quick Selection */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-[#00796B]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#1F4E79]">
            Predefined Quotation Templates
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => handleApplyTemplate(tpl.id)}
              className={`p-3 text-left rounded-xl border text-xs transition-all cursor-pointer ${
                selectedTemplateId === tpl.id
                  ? 'border-[#00796B] bg-[#E0F2F1]/30 ring-1 ring-[#00796B]'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-[#F5F5F5]'
              }`}
            >
              <div className="font-bold text-[#333333] truncate">{tpl.name}</div>
              <div className="text-[11px] text-[#4B6584] line-clamp-1 mt-0.5">
                {tpl.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Proposal Details Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#4B6584]">
          Customer & Terms
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-[#333333] block mb-1">
              Select Customer *
            </label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] bg-white font-medium"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name} ({c.name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-[#333333] block mb-1">
              Proposal Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] font-medium"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#333333] block mb-1">
              Valid Until Date
            </label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] font-medium"
            />
          </div>
        </div>
      </div>

      {/* Dynamic Line Items Builder */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#4B6584]">
            Subscription Line Items
          </h3>
          <button
            type="button"
            onClick={handleAddLine}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#E3F2FD] text-[#1F4E79] hover:bg-[#1F4E79] hover:text-white text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Line</span>
          </button>
        </div>

        <div className="space-y-3">
          {lines.map((line, idx) => (
            <div
              key={idx}
              className="grid grid-cols-12 gap-3 items-center p-3 rounded-xl bg-[#F5F5F5]/60 border border-slate-200"
            >
              <div className="col-span-12 sm:col-span-5">
                <label className="text-[10px] font-bold text-[#4B6584] block mb-0.5">
                  Product / Service
                </label>
                <input
                  type="text"
                  value={line.product_name}
                  onChange={(e) => handleLineChange(idx, 'product_name', e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4E79] font-medium"
                />
              </div>

              <div className="col-span-4 sm:col-span-2">
                <label className="text-[10px] font-bold text-[#4B6584] block mb-0.5">
                  Cycle
                </label>
                <select
                  value={line.billing_interval}
                  onChange={(e) => handleLineChange(idx, 'billing_interval', e.target.value)}
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-medium"
                >
                  <option value="month">Monthly</option>
                  <option value="year">Annual</option>
                </select>
              </div>

              <div className="col-span-3 sm:col-span-2">
                <label className="text-[10px] font-bold text-[#4B6584] block mb-0.5">
                  Qty
                </label>
                <input
                  type="number"
                  min="1"
                  value={line.quantity}
                  onChange={(e) => handleLineChange(idx, 'quantity', Math.max(1, Number(e.target.value)))}
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-medium"
                />
              </div>

              <div className="col-span-4 sm:col-span-2">
                <label className="text-[10px] font-bold text-[#4B6584] block mb-0.5">
                  Unit Price (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={line.unit_price_rupees}
                  onChange={(e) => handleLineChange(idx, 'unit_price_rupees', Number(e.target.value))}
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-medium"
                />
              </div>

              <div className="col-span-1 sm:col-span-1 flex justify-center pt-3.5">
                <button
                  type="button"
                  disabled={lines.length <= 1}
                  onClick={() => handleRemoveLine(idx)}
                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-20 cursor-pointer"
                  title="Remove line"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totals & Tax Summary Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
        <div className="w-full sm:max-w-xs space-y-2">
          <label className="text-xs font-bold text-[#333333] block">
            Special Proposal Discount (₹)
          </label>
          <input
            type="number"
            min="0"
            value={discountRupees}
            onChange={(e) => setDiscountRupees(Number(e.target.value))}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] font-medium"
          />
          <span className="text-[11px] text-[#4B6584] block">
            Applies before 18% GST calculation.
          </span>
        </div>

        <div className="w-full sm:w-72 space-y-2 text-xs">
          <div className="flex justify-between text-[#4B6584]">
            <span>Subtotal:</span>
            <span className="font-semibold text-[#333333]">
              <Money minor={subtotalMinor} />
            </span>
          </div>

          {discountMinor > 0 && (
            <div className="flex justify-between text-rose-600">
              <span>Discount:</span>
              <span className="font-semibold">-<Money minor={discountMinor} /></span>
            </div>
          )}

          <div className="flex justify-between text-[#4B6584]">
            <span>Taxable Amount:</span>
            <span className="font-semibold text-[#333333]">
              <Money minor={taxableMinor} />
            </span>
          </div>

          <div className="flex justify-between text-[#4B6584]">
            <span>18% GST (CGST + SGST):</span>
            <span className="font-semibold text-[#333333]">
              <Money minor={gstMinor} />
            </span>
          </div>

          <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-bold text-[#1F4E79]">
            <span>Total with Taxes:</span>
            <span><Money minor={totalMinor} /></span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateQuotationPage;
