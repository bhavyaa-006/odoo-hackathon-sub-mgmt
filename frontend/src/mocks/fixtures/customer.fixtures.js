/**
 * Customer Overview and Profile Fixtures for Mock Data Mode
 */

export const mockCustomerOverview = {
  active_subscriptions: 2,
  next_invoice_date: '2026-11-15',
  estimated_next_invoice_minor: 499900, // ₹4,999.00
  outstanding_balance_minor: 149882, // ₹1,498.82
  pending_quotations: 1,
  currency: 'INR',
  recent_activity: [
    {
      id: 'act-01',
      title: 'Monthly Subscription Renewed',
      description: 'Growth Tier renewed automatically for period 15 Oct - 15 Nov 2026',
      timestamp: '2026-10-15T00:00:00Z',
      type: 'subscription',
    },
    {
      id: 'act-02',
      title: 'Partial Payment Received',
      description: 'Payment of ₹4,400.00 credited toward Invoice INV-2026-0089',
      timestamp: '2026-10-16T10:15:00Z',
      type: 'payment',
    },
    {
      id: 'act-03',
      title: 'New Quotation Issued',
      description: 'Enterprise Multi-Region Infrastructure Expansion (QT-2026-0041) available for review',
      timestamp: '2026-10-25T11:00:00Z',
      type: 'quotation',
    },
  ],
};

export const mockCustomerProfile = {
  id: 'usr-customer-1',
  name: 'Alex Mercer',
  email: 'customer@brightloop.io',
  phone: '+91 98765 43210',
  company_name: 'Mercer Media Private Limited',
  gstin: '29ABCDE1234F1Z5',
  billing_address: 'Suite 402, Prestige Cyber Towers, Outer Ring Road, Bengaluru',
  state: 'Karnataka',
  role: 'customer',
  currency: 'INR',
  created_at: '2025-06-15T09:30:00Z',
};
