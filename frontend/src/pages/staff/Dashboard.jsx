import { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  Layers,
  FileSpreadsheet,
  Receipt,
  AlertTriangle,
  CreditCard,
  CheckCircle2,
  Clock,
  ArrowRight,
  PlusCircle,
  PlayCircle,
  ShieldCheck,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { staffService } from '../../services/staff.service';
import { useAuth } from '../../hooks/useAuth';
import StatCard from '../../components/staff/StatCard';
import Money from '../../components/ui/Money';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export const StaffDashboard = () => {
  const { user } = useAuth();
  const { openTimeMachine } = useOutletContext() || {};
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const res = await staffService.getDashboard();
        if (isMounted) {
          setData(res);
        }
      } catch (err) {
        console.error('Failed to load staff dashboard:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading operations workspace..." />
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const myWork = data?.my_work_today || [];
  const activity = data?.recent_activity || [];

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#1F4E79] to-[#00796B] rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs text-xs font-semibold text-amber-300 mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Operations Dispatch Active</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-heading tracking-tight">
              Welcome back, {user?.name || 'Staff Specialist'}
            </h1>
            <p className="text-xs sm:text-sm text-white/80 mt-1 max-w-xl">
              You have {kpis.invoices_requiring_attention_count || 5} billing items and{' '}
              {myWork.length} operational priorities requiring review today.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/staff/quotations/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-[#1F4E79] font-bold text-xs hover:bg-[#E3F2FD] transition-colors shadow-xs"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>New Quotation</span>
            </Link>

            <Link
              to="/staff/payments/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors border border-white/20"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Record Payment</span>
            </Link>

            {openTimeMachine && (
              <button
                type="button"
                onClick={openTimeMachine}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 text-amber-950 font-bold text-xs hover:bg-amber-300 transition-colors shadow-xs cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Simulate Clock</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Subscriptions"
          value={kpis.active_subscriptions_count || 14}
          subtitle={`${kpis.assigned_customers_count || 7} accounts assigned to you`}
          icon={Layers}
          color="navy"
          trend="+8% this quarter"
        />

        <StatCard
          title="Outstanding Receivables"
          value={<Money minor={kpis.outstanding_receivables_minor || 0} />}
          subtitle="Total open ledger balance"
          icon={Receipt}
          color="slate"
        />

        <StatCard
          title="Overdue Receivables"
          value={<Money minor={kpis.overdue_amount_minor || 0} />}
          subtitle={`${kpis.overdue_invoices_count || 4} past-due invoices`}
          icon={AlertTriangle}
          color="rose"
          trend="Action required"
        />

        <StatCard
          title="Pending Quotations"
          value={kpis.pending_quotations_count || 2}
          subtitle="Draft & awaiting confirmation"
          icon={FileSpreadsheet}
          color="amber"
        />
      </div>

      {/* Two Column Layout: My Work Today & Recent Operational Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: My Work Today */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#00796B]" />
              <h2 className="text-base font-bold font-heading text-[#1F4E79]">
                My Work Today ({myWork.length})
              </h2>
            </div>
            <span className="text-xs text-[#4B6584]">Prioritized operational queue</span>
          </div>

          <div className="space-y-3">
            {myWork.map((task) => (
              <div
                key={task.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 hover:border-[#1F4E79]/30 transition-all shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        task.priority === 'high'
                          ? 'bg-rose-100 text-rose-800'
                          : task.priority === 'medium'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {task.priority}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#E3F2FD] text-[#1F4E79] uppercase">
                      {task.category}
                    </span>
                    <span className="text-[11px] text-[#4B6584] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#4B6584]" />
                      {task.due}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-[#333333]">{task.title}</h3>
                  <p className="text-xs text-[#4B6584] line-clamp-2 leading-relaxed">
                    {task.description}
                  </p>
                </div>

                <Link
                  to={task.link}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E3F2FD] text-[#1F4E79] hover:bg-[#1F4E79] hover:text-white font-bold text-xs transition-colors shrink-0 self-start sm:self-center"
                >
                  <span>{task.action_label}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Right 1 Col: Recent Activity & Quick Ops Links */}
        <div className="space-y-6">
          {/* Quick Operations Links */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#4B6584] mb-3">
              Operational Hub
            </h3>
            <div className="space-y-2">
              <Link
                to="/staff/billing-runs"
                className="flex items-center justify-between p-3 rounded-xl hover:bg-[#F5F5F5] transition-colors border border-transparent hover:border-slate-200"
              >
                <div className="flex items-center gap-2.5">
                  <PlayCircle className="w-4 h-4 text-[#1F4E79]" />
                  <span className="text-xs font-bold text-[#333333]">Billing Runs</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#4B6584]" />
              </Link>

              <Link
                to="/staff/overdue"
                className="flex items-center justify-between p-3 rounded-xl hover:bg-[#F5F5F5] transition-colors border border-transparent hover:border-slate-200"
              >
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span className="text-xs font-bold text-[#333333]">Aging & Overdue</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                  {kpis.overdue_invoices_count || 4}
                </span>
              </Link>

              <Link
                to="/staff/integrity"
                className="flex items-center justify-between p-3 rounded-xl hover:bg-[#F5F5F5] transition-colors border border-transparent hover:border-slate-200"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-[#00796B]" />
                  <span className="text-xs font-bold text-[#333333]">Integrity Audit</span>
                </div>
                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                  8 Passed
                </span>
              </Link>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#4B6584] mb-4">
              Recent Ops Activity
            </h3>
            <div className="space-y-4">
              {activity.map((item) => (
                <div key={item.id} className="flex items-start gap-3 text-xs">
                  <div className="w-2 h-2 rounded-full bg-[#1F4E79] mt-1.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[#333333] leading-tight">{item.title}</p>
                    <p className="text-[11px] text-[#4B6584] mt-0.5 leading-relaxed">
                      {item.description}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                      <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                      {item.link && (
                        <Link to={item.link} className="text-[#1F4E79] font-bold hover:underline">
                          View &rarr;
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;
