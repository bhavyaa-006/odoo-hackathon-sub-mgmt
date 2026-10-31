/**
 * Staff Billing Runs Fixtures
 */

export const mockStaffBillingRuns = [
  {
    id: 'brun-2026-10-batch',
    run_number: 'RUN-2026-10-15',
    run_date: '2026-10-15T00:00:00Z',
    billing_period: '15 Oct 2026 – 14 Nov 2026',
    billing_date: '2026-10-15',
    total_subscriptions_processed: 18,
    eligible_subscriptions: 14,
    invoices_generated: 14,
    skipped_subscriptions: 4,
    failed_items: 0,
    total_amount_minor: 48988200, // ₹4,89,882.00
    status: 'committed',
    execution_type: 'automatic_batch',
    executed_by: 'System Scheduler (Cron)',
    summary: 'Regular mid-month billing run completed successfully. 14 invoices issued.',
    eligible_list: [
      { id: 'sub-staff-101', subscription_number: 'SUB-2026-00101', customer_name: 'Alex Mercer', plan_name: 'Brightloop Professional Cloud', amount_minor: 499900, status: 'billed', generated_invoice_number: 'INV-2026-0089' },
    ],
    skipped_list: [
      { id: 'sub-staff-105', subscription_number: 'SUB-2026-00105', customer_name: 'Suresh Menon', reason: 'Subscription is in PAUSED status' },
      { id: 'sub-staff-106', subscription_number: 'SUB-2026-00106', customer_name: 'Tarun Mathur', reason: 'Subscription term has EXPIRED / CLOSED' },
      { id: 'sub-staff-102', subscription_number: 'SUB-2026-00102', customer_name: 'Rohan Sharma', reason: 'Annual billing interval - next renewal due in Jul 2027' },
      { id: 'sub-staff-108', subscription_number: 'SUB-2026-00108', customer_name: 'Meera Iyer', reason: 'Subscription in CONFIRMED status (activation date Nov 1)' },
    ],
    failed_list: [],
  },
  {
    id: 'brun-2026-10-early',
    run_number: 'RUN-2026-10-01',
    run_date: '2026-10-01T00:00:00Z',
    billing_period: '01 Oct 2026 – 31 Oct 2026',
    billing_date: '2026-10-01',
    total_subscriptions_processed: 12,
    eligible_subscriptions: 8,
    invoices_generated: 7,
    skipped_subscriptions: 4,
    failed_items: 1,
    total_amount_minor: 15400000,
    status: 'committed',
    execution_type: 'manual_commit',
    executed_by: 'Sarah Chen',
    summary: 'Month-start billing run completed with 1 failed item requiring tax code resolution.',
    eligible_list: [
      { id: 'sub-staff-104', subscription_number: 'SUB-2026-00104', customer_name: 'Karthik Raja', plan_name: 'Brightloop Starter', amount_minor: 199900, status: 'billed', generated_invoice_number: 'INV-2026-0091' },
      { id: 'sub-staff-107', subscription_number: 'SUB-2026-00107', customer_name: 'Arjun Nambiar', plan_name: 'Brightloop Professional Cloud', amount_minor: 399900, status: 'billed', generated_invoice_number: 'INV-2026-0092' },
    ],
    skipped_list: [
      { id: 'sub-staff-105', subscription_number: 'SUB-2026-00105', customer_name: 'Suresh Menon', reason: 'Paused status' },
    ],
    failed_list: [
      {
        id: 'fail-01',
        subscription_id: 'sub-staff-999',
        subscription_number: 'SUB-2026-TEMP',
        customer_name: 'Kalinga Cloud Infrastructures',
        error_code: 'TAX_HSN_LOOKUP_FAILED',
        error_message: 'Customer billing address state code 21 requires valid IGST interstate rate.',
        can_retry: true,
      },
    ],
  },
  {
    id: 'brun-preview-upcoming',
    run_number: 'RUN-2026-11-01-PREVIEW',
    run_date: '2026-10-31T09:00:00Z',
    billing_period: '01 Nov 2026 – 30 Nov 2026',
    billing_date: '2026-11-01',
    total_subscriptions_processed: 20,
    eligible_subscriptions: 9,
    invoices_generated: 0,
    skipped_subscriptions: 11,
    failed_items: 0,
    total_amount_minor: 21500000, // Expected ₹2,15,000.00
    status: 'preview',
    execution_type: 'preview_only',
    executed_by: 'Sarah Chen',
    summary: 'Ready for dry run or commit. 9 subscriptions eligible for 01 Nov cycle billing.',
    eligible_list: [
      { id: 'sub-staff-108', subscription_number: 'SUB-2026-00108', customer_name: 'Meera Iyer', plan_name: 'Brightloop Growth Edition', amount_minor: 499900, expected_invoice_total_minor: 589882 },
      { id: 'sub-staff-103', subscription_number: 'SUB-2026-00103', customer_name: 'Ananya Deshmukh', plan_name: 'Brightloop Growth Edition', amount_minor: 999900, expected_invoice_total_minor: 1179882 },
    ],
    skipped_list: [
      { id: 'sub-staff-101', subscription_number: 'SUB-2026-00101', customer_name: 'Alex Mercer', reason: 'Billed on 15th of the month' },
      { id: 'sub-staff-102', subscription_number: 'SUB-2026-00102', customer_name: 'Rohan Sharma', reason: 'Annual subscription' },
    ],
    failed_list: [],
  },
];
