/**
 * Staff Dashboard Operational Overview Fixtures
 */

export const mockStaffDashboard = {
  kpis: {
    assigned_customers_count: 7,
    active_subscriptions_count: 14,
    pending_quotations_count: 2,
    invoices_requiring_attention_count: 5, // 1 draft needing confirmation + 4 overdue
    overdue_invoices_count: 4,
    payments_today_count: 2,
    payments_today_minor: 589882, // ₹5,898.82
    outstanding_receivables_minor: 5695646, // ₹56,956.46
    overdue_amount_minor: 975646, // ₹9,756.46
    currency: 'INR',
  },

  my_work_today: [
    {
      id: 'task-01',
      title: 'Follow up on Dunning: Kaviar Embedded',
      description: 'Invoice INV-2026-0091 is 16 days past due. Second card decline occurred on 20 Oct.',
      priority: 'high',
      due: 'Today, 2:00 PM',
      link: '/staff/dunning/dun-001',
      action_label: 'View Dunning Case',
      category: 'collections',
    },
    {
      id: 'task-02',
      title: 'Confirm Draft Invoice for Deccan Cybernetics',
      description: 'Monthly high-concurrency API gateway invoice INV-2026-0095 (₹47,200.00) awaits confirmation.',
      priority: 'medium',
      due: 'Today, 4:00 PM',
      link: '/staff/invoices/inv-staff-006',
      action_label: 'Review Invoice',
      category: 'billing',
    },
    {
      id: 'task-03',
      title: 'Review Pending Enterprise Quotation',
      description: 'Alex Mercer opened quotation QT-2026-00101 (₹1,53,990.00). Follow up on technical SLA questions.',
      priority: 'medium',
      due: 'Today, 5:30 PM',
      link: '/staff/quotations/qt-staff-001',
      action_label: 'Open Quotation',
      category: 'sales',
    },
    {
      id: 'task-04',
      title: 'Review Upcoming Nov 1 Billing Run Preview',
      description: '9 subscriptions scheduled for automatic billing run on 01 Nov 2026 (Est. ₹2,15,000.00).',
      priority: 'low',
      due: 'Tomorrow, 10:00 AM',
      link: '/staff/billing-runs/brun-preview-upcoming',
      action_label: 'Inspect Run',
      category: 'billing',
    },
  ],

  recent_activity: [
    {
      id: 'act-01',
      title: 'Partial Payment Recorded',
      description: 'Alex Mercer paid ₹4,400.00 via UPI towards INV-2026-0089',
      timestamp: '2026-10-16T10:15:00Z',
      type: 'payment',
      link: '/staff/payments/pay-staff-001',
    },
    {
      id: 'act-02',
      title: 'Quotation Accepted by Orbit Retail',
      description: 'Meera Iyer confirmed proposal QT-2026-00103. Subscription SUB-2026-00108 scheduled.',
      timestamp: '2026-10-20T14:10:00Z',
      type: 'quotation',
      link: '/staff/quotations/qt-staff-003',
    },
    {
      id: 'act-03',
      title: 'Quotation Dispatched to Mercer Media',
      description: 'Enterprise Multi-Region Infrastructure Expansion proposal (QT-2026-00101) sent.',
      timestamp: '2026-10-25T11:05:00Z',
      type: 'quotation',
      link: '/staff/quotations/qt-staff-001',
    },
    {
      id: 'act-04',
      title: 'Automated Billing Run Completed',
      description: 'Run RUN-2026-10-15 processed 14 subscriptions, issuing ₹4,89,882.00 in invoices.',
      timestamp: '2026-10-15T00:00:00Z',
      type: 'billing_run',
      link: '/staff/billing-runs/brun-2026-10-batch',
    },
  ],
};
