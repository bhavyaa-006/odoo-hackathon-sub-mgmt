/**
 * Staff Credit Notes Fixtures
 */

export const mockStaffCreditNotes = [
  {
    id: 'cn-staff-001',
    credit_note_number: 'CN-2026-0001',
    original_invoice_id: 'inv-staff-005',
    original_invoice_number: 'INV-2026-0075',
    customer_id: 'cust-001',
    customer_name: 'Alex Mercer',
    customer_company: 'Mercer Media Private Limited',
    customer_gstin: '29ABCDE1234F1Z5',
    issue_date: '2026-09-20',
    amount_minor: 50000, // ₹500.00 credit adjustment for downtime compensation
    tax_adjustment_minor: 9000, // 18% GST reversal
    total_credit_minor: 59000, // ₹590.00
    applied_amount_minor: 0,
    remaining_credit_minor: 59000, // ₹590.00 available credit
    status: 'issued', // 'issued' | 'partially_applied' | 'fully_applied'
    reason: 'SLA uptime compensation credit for scheduled cloud maintenance overrun',
    notes: 'Approved by Support Lead as goodwill credit against next billing cycle.',
    created_by: 'Sarah Chen',
    created_at: '2026-09-20T11:30:00Z',
    lines: [
      {
        id: 'cnl-1',
        description: 'Downtime SLA Service Credit (1 hour maintenance window)',
        quantity: 1,
        unit_price_minor: 50000,
        tax_rate: '18%',
        tax_minor: 9000,
        line_total_minor: 59000,
      },
    ],
  },
  {
    id: 'cn-staff-002',
    credit_note_number: 'CN-2026-0002',
    original_invoice_id: 'inv-staff-006',
    original_invoice_number: 'INV-2026-0076',
    customer_id: 'cust-002',
    customer_name: 'Rohan Sharma',
    customer_company: 'Apex Logistics Solutions Ltd',
    customer_gstin: '27AABCA5678G1Z2',
    issue_date: '2026-08-25',
    amount_minor: 2500000, // ₹25,000.00
    tax_adjustment_minor: 450000,
    total_credit_minor: 2950000, // ₹29,500.00
    applied_amount_minor: 2950000, // Fully applied
    remaining_credit_minor: 0,
    status: 'fully_applied',
    reason: 'Volume discount rebate retroactively credited for multi-region fleet contract',
    notes: 'Credit applied against renewal advance deposit.',
    created_by: 'David Vance',
    created_at: '2026-08-25T14:00:00Z',
    lines: [
      {
        id: 'cnl-2',
        description: 'Enterprise Tier Multi-Region Volume Rebate',
        quantity: 1,
        unit_price_minor: 2500000,
        tax_rate: '18%',
        tax_minor: 450000,
        line_total_minor: 2950000,
      },
    ],
  },
];
