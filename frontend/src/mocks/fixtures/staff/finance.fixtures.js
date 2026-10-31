/**
 * Staff Finance Dashboard Fixtures
 */

export const mockStaffFinance = {
  kpis: {
    mrr_minor: 48500000,               // ₹4,85,000.00 current MRR
    mrr_growth_pct: 12.4,              // +12.4% MoM
    revenue_collected_minor: 38246882, // ₹3,82,468.82 collected this month
    outstanding_receivables_minor: 5695646, // ₹56,956.46
    overdue_receivables_minor: 975646, // ₹9,756.46
    active_subscriptions: 14,
    total_payments_received: 24,
    collection_rate_pct: 86.8,
    currency: 'INR',
  },

  revenue_over_time: [
    { period: 'May 2026', collected_minor: 28000000, receivables_minor: 4200000, total_billed_minor: 32200000 },
    { period: 'Jun 2026', collected_minor: 31500000, receivables_minor: 3800000, total_billed_minor: 35300000 },
    { period: 'Jul 2026', collected_minor: 35000000, receivables_minor: 4500000, total_billed_minor: 39500000 },
    { period: 'Aug 2026', collected_minor: 34200000, receivables_minor: 4900000, total_billed_minor: 39100000 },
    { period: 'Sep 2026', collected_minor: 36800000, receivables_minor: 5100000, total_billed_minor: 41900000 },
    { period: 'Oct 2026', collected_minor: 38246882, receivables_minor: 5695646, total_billed_minor: 43942528 },
  ],

  revenue_by_product: [
    { name: 'Brightloop Professional Cloud', value_minor: 18500000, share_pct: 38.1, color: '#1F4E79' },
    { name: 'Brightloop Enterprise Cluster', value_minor: 15000000, share_pct: 30.9, color: '#00796B' },
    { name: 'Growth Edition', value_minor: 8500000, share_pct: 17.5, color: '#1E88E5' },
    { name: 'Encrypted Cloud Backup', value_minor: 4500000, share_pct: 9.3, color: '#A8D5BA' },
    { name: 'Starter Tier Platform', value_minor: 2000000, share_pct: 4.2, color: '#4B6584' },
  ],

  subscription_status_distribution: [
    { status: 'Active', count: 14, color: '#00796B' },
    { status: 'Confirmed', count: 1, color: '#1E88E5' },
    { status: 'Past Due', count: 2, color: '#FFC107' },
    { status: 'Paused', count: 1, color: '#4B6584' },
    { status: 'Closed', count: 2, color: '#FF6F61' },
  ],

  mrr_movements: {
    period: 'October 2026',
    opening_mrr_minor: 43200000, // ₹4,32,000.00
    new_mrr_minor: 5800000,      // +₹58,000.00 (from 2 new enterprise signups)
    expansion_mrr_minor: 1900000,// +₹19,000.00 (from tier upgrades)
    contraction_mrr_minor: 900000,// -₹9,000.00 (from downscaled compute units)
    churn_mrr_minor: 1500000,    // -₹15,000.00 (from 1 legacy subscription closure)
    closing_mrr_minor: 48500000, // ₹4,85,000.00 (Reconciles: 43200000 + 5800000 + 1900000 - 900000 - 1500000 = 48500000)
    ai_explanation: 'Strong net expansion (+₹53,000 net MRR) driven by Apex Logistics annual multi-region renewal and new retail growth tier onboardings. Churn was limited to 1 legacy non-renewed analytics contract.',
    waterfall_data: [
      { name: 'Opening MRR', value_minor: 43200000, type: 'base' },
      { name: 'New Subscriptions', value_minor: 5800000, type: 'positive' },
      { name: 'Expansion / Upgrades', value_minor: 1900000, type: 'positive' },
      { name: 'Contractions', value_minor: -900000, type: 'negative' },
      { name: 'Churn', value_minor: -1500000, type: 'negative' },
      { name: 'Closing MRR', value_minor: 48500000, type: 'total' },
    ],
  },
};
