import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Building,
  Mail,
  Phone,
  MapPin,
  FileSpreadsheet,
  Receipt,
  Layers,
  CreditCard,
  Clock,
  Edit3,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { customerService } from '../../../services/customer.service';
import StatusBadge from '../../../components/ui/StatusBadge';
import Money from '../../../components/ui/Money';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

export const CustomerDetailPage = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [notice, setNotice] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await customerService.getStaffCustomer(id);
      setData(res);
      setSelectedStaffId(res.customer?.assigned_staff_id || '');
    } catch (err) {
      console.error('Failed to load customer details:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const res = await customerService.getStaffCustomer(id);
        if (isMounted) {
          setData(res);
          setSelectedStaffId(res.customer?.assigned_staff_id || '');
        }
      } catch (err) {
        console.error('Failed to load customer details:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    run();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleAssignStaff = async (e) => {
    e.preventDefault();
    if (!selectedStaffId) return;
    try {
      setReassigning(true);
      const res = await customerService.assignStaff(id, selectedStaffId);
      setNotice({
        type: 'success',
        message: res.message || 'Assigned staff specialist updated successfully.',
      });
      setReassignModalOpen(false);
      fetchData();
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      setNotice({
        type: 'error',
        message: err.message || 'Failed to reassign staff.',
      });
    } finally {
      setReassigning(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading customer account profile..." />
      </div>
    );
  }

  if (!data?.customer) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto my-12">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-[#1F4E79]">Customer Not Found</h3>
        <p className="text-xs text-[#4B6584] mt-1">
          No customer account matches identifier "{id}".
        </p>
        <Link
          to="/staff/customers"
          className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-[#1F4E79] text-white rounded-xl text-xs font-bold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Customers</span>
        </Link>
      </div>
    );
  }

  const { customer, subscriptions = [], quotations = [], invoices = [], payments = [], activity = [], staff_members = [] } = data;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Building },
    { id: 'subscriptions', label: `Subscriptions (${subscriptions.length})`, icon: Layers },
    { id: 'quotations', label: `Quotations (${quotations.length})`, icon: FileSpreadsheet },
    { id: 'invoices', label: `Invoices (${invoices.length})`, icon: Receipt },
    { id: 'payments', label: `Payments (${payments.length})`, icon: CreditCard },
    { id: 'activity', label: 'Activity Audit', icon: Clock },
  ];

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        to="/staff/customers"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4B6584] hover:text-[#1F4E79] transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Customer Directory</span>
      </Link>

      {/* Notice Banner */}
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

      {/* Customer Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#E3F2FD] text-[#1F4E79] flex items-center justify-center font-bold text-lg shrink-0">
            {customer.name ? customer.name.slice(0, 2).toUpperCase() : 'CU'}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold font-heading text-[#1F4E79]">
                {customer.company_name || customer.name}
              </h1>
              <StatusBadge status={customer.status || 'active'} />
            </div>
            <p className="text-xs text-[#4B6584] mt-1">
              Contact: <span className="font-semibold text-[#333333]">{customer.name}</span> • ID: {customer.customer_number}
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs text-[#4B6584] flex-wrap">
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-[#1F4E79]" />
                {customer.email}
              </span>
              {customer.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-[#00796B]" />
                  {customer.phone}
                </span>
              )}
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {customer.city || 'Bengaluru'}, {customer.state || 'Karnataka'}
              </span>
            </div>
          </div>
        </div>

        {/* Assigned Staff & Balance Pill */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="bg-[#F5F5F5] rounded-xl p-3 border border-slate-200 min-w-[160px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#4B6584] block">
              Reconciled Balance
            </span>
            <div className="text-base font-bold text-[#1F4E79] mt-0.5">
              <Money minor={customer.reconciled_balance_minor || 0} />
            </div>
          </div>

          <div className="bg-[#E3F2FD]/50 rounded-xl p-3 border border-[#1F4E79]/20 min-w-[160px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F4E79] block">
              Staff Specialist
            </span>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <span className="text-xs font-bold text-[#333333] truncate">
                {customer.assigned_staff_name || 'Unassigned'}
              </span>
              <button
                type="button"
                onClick={() => setReassignModalOpen(true)}
                className="p-1 text-[#1F4E79] hover:bg-white rounded-md transition-colors"
                title="Reassign specialist"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-2 overflow-x-auto pb-1" aria-label="Customer Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-[#1F4E79] text-white shadow-xs'
                    : 'text-[#4B6584] hover:bg-[#F5F5F5] hover:text-[#333333]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Panels */}
      {/* 1. Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold font-heading text-[#1F4E79]">
              Billing & Tax Configuration
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-[#4B6584]">GSTIN</span>
                <span className="font-mono font-bold text-[#333333]">
                  {customer.gstin || 'Not registered / B2C'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-[#4B6584]">Tax Regime</span>
                <span className="font-semibold text-[#333333]">
                  {customer.state === 'Karnataka'
                    ? 'Intra-State (9% CGST + 9% SGST)'
                    : 'Inter-State (18% IGST)'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-[#4B6584]">Payment Terms</span>
                <span className="font-semibold text-[#333333]">Net 15 Days</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[#4B6584]">Account Created</span>
                <span className="font-medium text-[#333333]">
                  {customer.created_at ? new Date(customer.created_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold font-heading text-[#1F4E79]">
              Registered Address
            </h3>
            <div className="text-xs text-[#333333] leading-relaxed space-y-1">
              <p className="font-bold">{customer.company_name}</p>
              <p>{customer.address_line1 || 'No. 42, Tech Square, Outer Ring Road'}</p>
              {customer.address_line2 && <p>{customer.address_line2}</p>}
              <p>
                {customer.city || 'Bengaluru'}, {customer.state || 'Karnataka'} - {customer.postal_code || '560103'}
              </p>
              <p className="text-[#4B6584]">India</p>
            </div>
          </div>
        </div>
      )}

      {/* 2. Subscriptions Tab */}
      {activeTab === 'subscriptions' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          {subscriptions.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#4B6584]">
              No subscriptions found for this customer.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {subscriptions.map((s) => (
                <div key={s.id} className="p-4 sm:p-5 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/staff/subscriptions/${s.id}`}
                        className="font-bold text-xs text-[#1F4E79] hover:underline"
                      >
                        {s.plan_name}
                      </Link>
                      <StatusBadge status={s.status} />
                    </div>
                    <p className="text-[11px] text-[#4B6584] mt-0.5">
                      Sub ID: {s.subscription_number} • Renewal: {s.next_billing_date || s.current_period_end}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs font-bold text-[#333333]">
                        <Money minor={s.unit_price_minor || 0} /> / {s.billing_interval}
                      </div>
                      <div className="text-[10px] text-slate-400">Recurring Price</div>
                    </div>
                    <Link
                      to={`/staff/subscriptions/${s.id}`}
                      className="px-3 py-1.5 bg-[#E3F2FD] text-[#1F4E79] rounded-xl text-xs font-bold hover:bg-[#1F4E79] hover:text-white transition-colors"
                    >
                      Manage
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. Quotations Tab */}
      {activeTab === 'quotations' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          {quotations.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#4B6584]">
              No quotations recorded for this customer.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {quotations.map((q) => (
                <div key={q.id} className="p-4 sm:p-5 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/staff/quotations/${q.id}`}
                        className="font-bold text-xs text-[#1F4E79] hover:underline"
                      >
                        {q.quotation_number}
                      </Link>
                      <StatusBadge status={q.status} />
                    </div>
                    <p className="text-[11px] text-[#4B6584] mt-0.5">
                      Template: {q.template_name || 'Standard'} • Valid Until: {q.valid_until}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs font-bold text-[#333333]">
                        <Money minor={q.total_minor || 0} />
                      </div>
                      <div className="text-[10px] text-slate-400">Total with GST</div>
                    </div>
                    <Link
                      to={`/staff/quotations/${q.id}`}
                      className="px-3 py-1.5 bg-[#E3F2FD] text-[#1F4E79] rounded-xl text-xs font-bold hover:bg-[#1F4E79] hover:text-white transition-colors"
                    >
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. Invoices Tab */}
      {activeTab === 'invoices' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          {invoices.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#4B6584]">
              No invoices generated for this customer.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <div key={inv.id} className="p-4 sm:p-5 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/staff/invoices/${inv.id}`}
                        className="font-bold text-xs text-[#1F4E79] hover:underline"
                      >
                        {inv.invoice_number}
                      </Link>
                      <StatusBadge status={inv.status} />
                    </div>
                    <p className="text-[11px] text-[#4B6584] mt-0.5">
                      Date: {inv.issue_date} • Due: {inv.due_date}
                      {inv.days_overdue > 0 && (
                        <span className="text-rose-600 font-bold ml-1.5">
                          ({inv.days_overdue}d overdue)
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs font-bold text-[#333333]">
                        <Money minor={inv.total_minor || 0} />
                      </div>
                      <div className="text-[10px] text-[#4B6584]">
                        Outstanding: <Money minor={inv.outstanding_minor || 0} />
                      </div>
                    </div>
                    <Link
                      to={`/staff/invoices/${inv.id}`}
                      className="px-3 py-1.5 bg-[#E3F2FD] text-[#1F4E79] rounded-xl text-xs font-bold hover:bg-[#1F4E79] hover:text-white transition-colors"
                    >
                      Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. Payments Tab */}
      {activeTab === 'payments' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          {payments.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#4B6584]">
              No payments logged for this customer.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {payments.map((p) => (
                <div key={p.id} className="p-4 sm:p-5 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/staff/payments/${p.id}`}
                        className="font-bold text-xs text-[#1F4E79] hover:underline"
                      >
                        {p.payment_reference}
                      </Link>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                        {p.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#4B6584] mt-0.5">
                      Date: {p.payment_date} • Method: {p.payment_method} • Invoice: {p.invoice_number || 'N/A'}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs font-bold text-emerald-700">
                        <Money minor={p.amount_minor || 0} />
                      </div>
                      <div className="text-[10px] text-slate-400">Reconciled</div>
                    </div>
                    <Link
                      to={`/staff/payments/${p.id}`}
                      className="px-3 py-1.5 bg-[#E3F2FD] text-[#1F4E79] rounded-xl text-xs font-bold hover:bg-[#1F4E79] hover:text-white transition-colors"
                    >
                      Receipt
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. Activity Tab */}
      {activeTab === 'activity' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="space-y-4">
            {activity.map((act) => (
              <div key={act.id} className="flex items-start gap-3.5 text-xs">
                <div className="w-2.5 h-2.5 rounded-full bg-[#1F4E79] mt-1 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-[#333333]">{act.title}</h4>
                    <span className="text-[10px] text-[#4B6584]">
                      {act.date ? new Date(act.date).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#4B6584] mt-0.5">{act.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reassign Staff Modal */}
      {reassignModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold font-heading text-[#1F4E79]">
                Reassign Staff Specialist
              </h3>
              <button
                onClick={() => setReassignModalOpen(false)}
                className="text-[#4B6584] hover:text-[#333333]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignStaff} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-[#333333] block mb-1">
                  Select Staff Member
                </label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] bg-white font-medium text-[#333333]"
                >
                  <option value="">Choose specialist...</option>
                  {staff_members.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name} — {staff.role} ({staff.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReassignModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-bold text-[#4B6584] hover:bg-[#F5F5F5] rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reassigning || !selectedStaffId}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#1F4E79] hover:bg-[#163a5c] rounded-xl disabled:opacity-50"
                >
                  {reassigning ? 'Assigning...' : 'Save Specialist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerDetailPage;
