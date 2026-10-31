/**
 * Staff Overdue Invoices and Aging Buckets Fixtures
 */

export const mockStaffOverdue = {
  summary: {
    total_overdue_invoices: 4,
    total_overdue_amount_minor: 975646, // ₹9,756.46
    customers_with_overdue: 4,
    average_days_overdue: 9.5,
    recovery_amount_minor: 440000, // ₹4,400.00 recovered this month
    currency: 'INR',
  },
  aging_buckets: [
    {
      bucket: '1-30 days',
      label: '1–30 Days',
      invoice_count: 4,
      amount_minor: 975646, // All current overdue items fall in 1-30 days
      percentage: 100,
      color: 'amber',
    },
    {
      bucket: '31-60 days',
      label: '31–60 Days',
      invoice_count: 0,
      amount_minor: 0,
      percentage: 0,
      color: 'coral',
    },
    {
      bucket: '61-90 days',
      label: '61–90 Days',
      invoice_count: 0,
      amount_minor: 0,
      percentage: 0,
      color: 'coral',
    },
    {
      bucket: '90+ days',
      label: '90+ Days',
      invoice_count: 0,
      amount_minor: 0,
      percentage: 0,
      color: 'slate',
    },
  ],
  invoices: [
    {
      id: 'inv-staff-001',
      invoice_number: 'INV-2026-0089',
      customer_id: 'cust-001',
      customer_name: 'Alex Mercer',
      customer_company: 'Mercer Media Private Limited',
      customer_email: 'customer@brightloop.io',
      invoice_date: '2026-10-15',
      due_date: '2026-10-30',
      days_overdue: 1,
      total_amount_minor: 589882,
      paid_amount_minor: 440000,
      outstanding_amount_minor: 149882, // ₹1,498.82
      status: 'posted',
      last_followup: '2026-10-31T08:00:00Z',
      followup_note: 'Automated dunning email sent to billing contact.',
      assigned_staff: 'Sarah Chen',
    },
    {
      id: 'inv-staff-002',
      invoice_number: 'INV-2026-0091',
      customer_id: 'cust-004',
      customer_name: 'Karthik Raja',
      customer_company: 'Kaviar Embedded Systems Pvt Ltd',
      customer_email: 'karthik@kaviartech.com',
      invoice_date: '2026-10-01',
      due_date: '2026-10-15',
      days_overdue: 16,
      total_amount_minor: 235882,
      paid_amount_minor: 0,
      outstanding_amount_minor: 235882, // ₹2,358.82
      status: 'payment_pending',
      last_followup: '2026-10-22T11:30:00Z',
      followup_note: 'Called accounting desk; card limit renewal pending.',
      assigned_staff: 'Sarah Chen',
      dunning_case_id: 'dun-001',
    },
    {
      id: 'inv-staff-003',
      invoice_number: 'INV-2026-0092',
      customer_id: 'cust-008',
      customer_name: 'Arjun Nambiar',
      customer_company: 'Malabar Cognition Works',
      customer_email: 'arjun@malabarai.io',
      invoice_date: '2026-10-01',
      due_date: '2026-10-16',
      days_overdue: 15,
      total_amount_minor: 471882,
      paid_amount_minor: 0,
      outstanding_amount_minor: 471882, // ₹4,718.82
      status: 'payment_pending',
      last_followup: '2026-10-25T14:00:00Z',
      followup_note: 'Firm reminder email dispatched with updated bank payment link.',
      assigned_staff: 'Vikram Joshi',
      dunning_case_id: 'dun-002',
    },
    {
      id: 'inv-staff-004',
      invoice_number: 'INV-2026-0093',
      customer_id: 'cust-017',
      customer_name: 'Manish Agarwal',
      customer_company: 'Malwa Financial Systems LLP',
      customer_email: 'manish@indorefin.com',
      invoice_date: '2026-10-10',
      due_date: '2026-10-25',
      days_overdue: 6,
      total_amount_minor: 118000,
      paid_amount_minor: 0,
      outstanding_amount_minor: 118000, // ₹1,180.00
      status: 'posted',
      last_followup: '2026-10-28T09:15:00Z',
      followup_note: 'Payment scheduled for upcoming weekly vendor clearance.',
      assigned_staff: 'Sarah Chen',
    },
  ],
};
