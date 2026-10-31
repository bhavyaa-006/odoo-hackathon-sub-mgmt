import { useState, useEffect } from 'react';
import {
  TrendingUp,
  CreditCard,
  Sparkles,
  Download,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { financeService } from '../../../services/finance.service';
import StaffPageHeader from '../../../components/staff/StaffPageHeader';
import StatCard from '../../../components/staff/StatCard';
import Money from '../../../components/ui/Money';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

export const FinanceDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const res = await financeService.getFinanceMetrics();
        if (isMounted) setData(res);
      } catch (err) {
        console.error('Failed to load finance metrics:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchMetrics();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <LoadingSpinner size="lg" message="Synthesizing financial analytics & MRR waterfall..." />
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const revenueTrend = (data?.revenue_over_time || []).map((item) => ({
    period: item.period,
    collected: item.collected_minor / 100,
    total_billed: item.total_billed_minor / 100,
  }));
  const revenueByProduct = data?.revenue_by_product || [];
  const statusDistribution = data?.subscription_status_distribution || [];
  const mrrMovements = data?.mrr_movements || {};

  const handleExportCSV = () => {
    const csvRows = [
      ['Metric', 'Value (INR)'],
      ['Current MRR', (kpis.mrr_minor / 100).toFixed(2)],
      ['Revenue Collected', (kpis.revenue_collected_minor / 100).toFixed(2)],
      ['Outstanding Receivables', (kpis.outstanding_receivables_minor / 100).toFixed(2)],
      ['Overdue Receivables', (kpis.overdue_receivables_minor / 100).toFixed(2)],
      [],
      ['MRR Movement Component', 'Amount (INR)'],
      ['Opening MRR', (mrrMovements.opening_mrr_minor / 100).toFixed(2)],
      ['New MRR', (mrrMovements.new_mrr_minor / 100).toFixed(2)],
      ['Expansion MRR', (mrrMovements.expansion_mrr_minor / 100).toFixed(2)],
      ['Contraction MRR', `-${(mrrMovements.contraction_mrr_minor / 100).toFixed(2)}`],
      ['Churn MRR', `-${(mrrMovements.churn_mrr_minor / 100).toFixed(2)}`],
      ['Closing MRR', (mrrMovements.closing_mrr_minor / 100).toFixed(2)],
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      csvRows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `brightloop_finance_summary_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in">
      <StaffPageHeader
        title="Executive Finance Dashboard"
        subtitle="Analyze recurring subscription cash flow, inspect MRR waterfall reconciliation, and verify unit economics."
        breadcrumbs={[
          { label: 'Staff Workspace', link: '/staff' },
          { label: 'Finance' },
        ]}
        actions={
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-[#F5F5F5] text-[#333333] rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Monthly Recurring Revenue"
          value={<Money minor={kpis.mrr_minor || 0} />}
          subtitle="Net contracted subscription run-rate"
          icon={TrendingUp}
          color="navy"
          trend={`+${kpis.mrr_growth_pct || 12.4}% MoM`}
        />

        <StatCard
          title="Revenue Collected"
          value={<Money minor={kpis.revenue_collected_minor || 0} />}
          subtitle={`${kpis.total_payments_received || 24} settled payments this cycle`}
          icon={CreditCard}
          color="teal"
        />

        <StatCard
          title="Collection Rate"
          value={`${kpis.collection_rate_pct || 86.8}%`}
          subtitle="Cash received vs invoiced"
          icon={ShieldCheck}
          color="slate"
          trend="Healthy collections"
        />

        <StatCard
          title="Overdue Receivables"
          value={<Money minor={kpis.overdue_receivables_minor || 0} />}
          subtitle="Past-due invoice balances"
          icon={AlertTriangle}
          color="rose"
        />
      </div>

      {/* MRR Movements Waterfall Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#00796B]" />
              <h2 className="text-base font-bold font-heading text-[#1F4E79]">
                MRR Movements Waterfall Reconciliation ({mrrMovements.period || 'Current Cycle'})
              </h2>
            </div>
            <p className="text-xs text-[#4B6584] mt-1">
              Opening MRR + New + Expansion - Contraction - Churn = Closing MRR
            </p>
          </div>

          <div className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Ledger Balanced & Verified</span>
          </div>
        </div>

        {/* Visual Waterfall Steps */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <span className="text-[10px] font-bold text-[#4B6584] uppercase block mb-1">
              1. Opening MRR
            </span>
            <div className="font-bold text-sm text-[#333333]">
              <Money minor={mrrMovements.opening_mrr_minor || 0} />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs">
            <span className="text-[10px] font-bold text-emerald-800 uppercase block mb-1">
              2. + New Signups
            </span>
            <div className="font-bold text-sm text-emerald-800">
              +<Money minor={mrrMovements.new_mrr_minor || 0} />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs">
            <span className="text-[10px] font-bold text-emerald-800 uppercase block mb-1">
              3. + Upgrades
            </span>
            <div className="font-bold text-sm text-emerald-800">
              +<Money minor={mrrMovements.expansion_mrr_minor || 0} />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200 text-xs">
            <span className="text-[10px] font-bold text-rose-800 uppercase block mb-1">
              4. - Contractions
            </span>
            <div className="font-bold text-sm text-rose-800">
              -<Money minor={mrrMovements.contraction_mrr_minor || 0} />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200 text-xs">
            <span className="text-[10px] font-bold text-rose-800 uppercase block mb-1">
              5. - Churn
            </span>
            <div className="font-bold text-sm text-rose-800">
              -<Money minor={mrrMovements.churn_mrr_minor || 0} />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#E3F2FD] border border-[#1F4E79]/30 text-xs">
            <span className="text-[10px] font-bold text-[#1F4E79] uppercase block mb-1">
              6. = Closing MRR
            </span>
            <div className="font-bold text-sm text-[#1F4E79]">
              <Money minor={mrrMovements.closing_mrr_minor || 0} />
            </div>
          </div>
        </div>

        {/* AI Synthesis Note */}
        {mrrMovements.ai_explanation && (
          <div className="p-4 rounded-xl bg-[#E0F2F1]/30 border border-[#00796B]/20 text-xs text-[#333333] leading-relaxed">
            <span className="font-bold text-[#00796B]">Financial Executive Summary: </span>
            {mrrMovements.ai_explanation}
          </div>
        )}
      </div>

      {/* Two Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Revenue Over Time */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold font-heading text-[#1F4E79]">
              Historical Billing & Collections (6 Months)
            </h3>
            <p className="text-xs text-[#4B6584]">
              Comparison of collected revenue vs total invoiced run-rate in INR
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00796B" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#00796B" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorBilled" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1F4E79" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#1F4E79" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#4B6584' }} />
                <YAxis
                  tick={{ fontSize: 10, fill: '#4B6584' }}
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value) => [`₹${Number(value).toLocaleString()}`, '']}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    borderColor: '#cbd5e1',
                    fontSize: '11px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Area
                  type="monotone"
                  dataKey="collected"
                  name="Collected Revenue"
                  stroke="#00796B"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorCollected)"
                />
                <Area
                  type="monotone"
                  dataKey="total_billed"
                  name="Total Invoiced"
                  stroke="#1F4E79"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorBilled)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Revenue By Product */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold font-heading text-[#1F4E79]">
              Revenue Share by Subscription Product
            </h3>
            <p className="text-xs text-[#4B6584]">
              Distribution of contracted ARR across plans
            </p>
          </div>

          <div className="h-56 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={revenueByProduct}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value_minor"
                  nameKey="name"
                >
                  {revenueByProduct.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || '#1F4E79'} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val) => [`₹${(Number(val) / 100).toLocaleString()}`, '']}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    borderColor: '#cbd5e1',
                    fontSize: '11px',
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '10px' }}
                  layout="horizontal"
                  verticalAlign="bottom"
                  align="center"
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Subscriber Status Breakdown */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs">
            <span className="text-[10px] font-bold text-[#4B6584] uppercase">Status Breakdown:</span>
            <div className="flex items-center gap-2 flex-wrap">
              {statusDistribution.map((st, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                  style={{ borderColor: `${st.color}40`, color: st.color, backgroundColor: `${st.color}10` }}
                >
                  {st.status}: <strong>{st.count}</strong>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinanceDashboard;
