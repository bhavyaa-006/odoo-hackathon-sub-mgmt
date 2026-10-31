/**
 * Staff Dunning Management Fixtures
 */

export const mockStaffDunning = {
  overview: {
    active_dunning_cases: 2,
    pending_retries: 2,
    successful_recoveries: 8,
    failed_recoveries: 1,
    recovery_rate_pct: 88.8,
    revenue_at_risk_minor: 707764, // ₹7,077.64 (sum of dun-001 ₹2,358.82 + dun-002 ₹4,718.82)
    currency: 'INR',
  },
  cases: [
    {
      id: 'dun-001',
      case_number: 'DUN-2026-0001',
      customer_id: 'cust-004',
      customer_name: 'Karthik Raja',
      customer_company: 'Kaviar Embedded Systems Pvt Ltd',
      customer_email: 'karthik@kaviartech.com',
      invoice_id: 'inv-staff-002',
      invoice_number: 'INV-2026-0091',
      subscription_id: 'sub-staff-104',
      subscription_number: 'SUB-2026-00104',
      outstanding_amount_minor: 235882, // ₹2,358.82
      currency: 'INR',
      retry_count: 2,
      max_retries: 4,
      next_retry_date: '2026-11-02T10:00:00Z',
      last_attempt_date: '2026-10-20T04:15:00Z',
      last_failure_reason: 'Card decline: Insufficient balance on corporate debit card',
      recovery_status: 'active', // 'active' | 'recovered' | 'suspended'
      attempts: [
        {
          id: 'att-1',
          attempt_number: 1,
          date: '2026-10-01T04:12:00Z',
          gateway: 'Razorpay / HDFC',
          amount_minor: 235882,
          result: 'declined',
          error_code: 'INSUFFICIENT_FUNDS',
          error_message: 'Customer bank declined debit due to insufficient card balance.',
        },
        {
          id: 'att-2',
          attempt_number: 2,
          date: '2026-10-20T04:15:00Z',
          gateway: 'Razorpay / HDFC',
          amount_minor: 235882,
          result: 'declined',
          error_code: 'CARD_LIMIT_EXCEEDED',
          error_message: 'Corporate card daily transaction quota exceeded.',
        },
      ],
      ai_reminders: {
        friendly: {
          tone: 'friendly',
          subject: 'Friendly reminder: Invoice INV-2026-0091 payment update for Kaviar Embedded',
          body: `Hi Karthik,\n\nWe noticed that your latest subscription renewal payment of ₹2,358.82 for Brightloop Starter didn't go through on your card.\n\nNo worries! You can quickly update your card details or pay online via UPI or NetBanking using the link below:\nhttps://app.brightloop.io/customer/invoices/inv-staff-002\n\nIf you need any assistance, our billing team is here to help.\n\nBest regards,\nBrightloop Accounts Team`,
        },
        firm: {
          tone: 'firm',
          subject: 'Action Required: Past due balance on Invoice INV-2026-0091',
          body: `Dear Karthik Raja,\n\nYour Brightloop Starter subscription invoice INV-2026-0091 with an outstanding balance of ₹2,358.82 is now 16 days past due. Automated retry attempts on 01 Oct and 20 Oct were declined by your bank.\n\nPlease settle this balance within 3 business days to prevent automated service interruption:\nhttps://app.brightloop.io/customer/invoices/inv-staff-002\n\nSincerely,\nBrightloop Collections Team`,
        },
        final: {
          tone: 'final',
          subject: 'FINAL NOTICE: Immediate payment required to avoid subscription suspension (INV-2026-0091)',
          body: `URGENT NOTICE\n\nDear Karthik Raja,\n\nDespite repeated notices, invoice INV-2026-0091 (₹2,358.82) remains unpaid. In accordance with Brightloop subscription terms, your platform access will be suspended on 03 Nov 2026 unless payment is received immediately.\n\nPay immediately:\nhttps://app.brightloop.io/customer/invoices/inv-staff-002\n\nBrightloop Risk & Legal Operations`,
        },
      },
    },
    {
      id: 'dun-002',
      case_number: 'DUN-2026-0002',
      customer_id: 'cust-008',
      customer_name: 'Arjun Nambiar',
      customer_company: 'Malabar Cognition Works',
      customer_email: 'arjun@malabarai.io',
      invoice_id: 'inv-staff-003',
      invoice_number: 'INV-2026-0092',
      subscription_id: 'sub-staff-107',
      subscription_number: 'SUB-2026-00107',
      outstanding_amount_minor: 471882, // ₹4,718.82
      currency: 'INR',
      retry_count: 1,
      max_retries: 4,
      next_retry_date: '2026-11-01T14:00:00Z',
      last_attempt_date: '2026-10-16T00:01:00Z',
      last_failure_reason: 'Mandate execution timeout on ICICI e-mandate',
      recovery_status: 'active',
      attempts: [
        {
          id: 'att-3',
          attempt_number: 1,
          date: '2026-10-16T00:01:00Z',
          gateway: 'NPCI / ICICI e-Mandate',
          amount_minor: 471882,
          result: 'declined',
          error_code: 'MANDATE_TIMEOUT',
          error_message: 'Recurring UPI auto-debit request timed out at payer bank.',
        },
      ],
      ai_reminders: {
        friendly: {
          tone: 'friendly',
          subject: 'Payment reminder for Malabar Cognition: Invoice INV-2026-0092',
          body: `Hi Arjun,\n\nWe encountered a timeout trying to process your recurring mandate payment of ₹4,718.82 for Brightloop Professional Cloud.\n\nYou can complete the payment in 30 seconds via direct UPI/NEFT:\nhttps://app.brightloop.io/customer/invoices/inv-staff-003\n\nWarm regards,\nBrightloop Operations`,
        },
        firm: {
          tone: 'firm',
          subject: 'Payment past due: Invoice INV-2026-0092 - Action Required',
          body: `Dear Arjun Nambiar,\n\nInvoice INV-2026-0092 for ₹4,718.82 is now 15 days overdue. Please settle this invoice immediately to ensure uninterrupted cognition API connector services.\n\nPayment URL:\nhttps://app.brightloop.io/customer/invoices/inv-staff-003\n\nBrightloop Credit Management`,
        },
        final: {
          tone: 'final',
          subject: 'Service Suspension Notice: Malabar Cognition API access',
          body: `FINAL WARNING\n\nDear Arjun Nambiar,\n\nAPI throughput for Cognition API Connector will be paused within 48 hours due to outstanding invoice INV-2026-0092 (₹4,718.82).\n\nPlease authorize payment immediately.\n\nBrightloop Finance Operations`,
        },
      },
    },
  ],
};
