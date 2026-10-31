import { describe, it } from 'node:test';
import assert from 'node:assert';
import { PORTAL_CONFIG, ROUTES } from '../routes/routeConfig.js';
import { formatMoney } from '../utils/formatters.js';
import staffMockAdapter from '../mocks/staffMockAdapter.js';
import { staffService } from '../services/staff.service.js';
import { quotationService } from '../services/quotation.service.js';
import { subscriptionService } from '../services/subscription.service.js';
import { invoiceService } from '../services/invoice.service.js';
import { paymentService } from '../services/payment.service.js';
import { billingService } from '../services/billing.service.js';
import { dunningService } from '../services/dunning.service.js';
import { creditNoteService } from '../services/creditNote.service.js';
import { financeService } from '../services/finance.service.js';
import { integrityService } from '../services/integrity.service.js';

describe('Brightloop Phase 3: Staff Workspace Tests', () => {
  describe('Role Guarding & Security Boundaries', () => {
    it('Staff workspace allowed roles include staff and finance, rejecting customer', () => {
      const allowed = PORTAL_CONFIG.staff.allowedRoles;
      assert.strictEqual(allowed.includes('staff'), true);
      assert.strictEqual(allowed.includes('finance'), true);
      assert.strictEqual(allowed.includes('customer'), false);
    });

    it('Staff workspace routes are scoped under /staff/*', () => {
      assert.strictEqual(ROUTES.STAFF_DASHBOARD, '/staff');
      assert.strictEqual(ROUTES.STAFF_CUSTOMERS, '/staff/customers');
      assert.strictEqual(ROUTES.STAFF_QUOTATIONS, '/staff/quotations');
      assert.strictEqual(ROUTES.STAFF_SUBSCRIPTIONS, '/staff/subscriptions');
      assert.strictEqual(ROUTES.STAFF_INVOICES, '/staff/invoices');
      assert.strictEqual(ROUTES.STAFF_PAYMENTS, '/staff/payments');
      assert.strictEqual(ROUTES.STAFF_DUNNING, '/staff/dunning');
      assert.strictEqual(ROUTES.STAFF_CREDIT_NOTES, '/staff/credit-notes');
      assert.strictEqual(ROUTES.STAFF_BILLING_RUNS, '/staff/billing-runs');
      assert.strictEqual(ROUTES.STAFF_FINANCE, '/staff/finance');
      assert.strictEqual(ROUTES.STAFF_INTEGRITY, '/staff/integrity');
      assert.strictEqual(ROUTES.STAFF_NOTIFICATIONS, '/staff/notifications');
    });

    it('Finance dashboard permission guard logic permits finance role or permission', () => {
      const hasFinanceAccess = (user) =>
        user?.role === 'admin' ||
        user?.role === 'finance' ||
        (Array.isArray(user?.permissions) && user.permissions.includes('finance'));

      assert.strictEqual(hasFinanceAccess({ role: 'finance' }), true);
      assert.strictEqual(hasFinanceAccess({ role: 'admin' }), true);
      assert.strictEqual(hasFinanceAccess({ role: 'staff', permissions: ['finance', 'billing'] }), true);
      assert.strictEqual(hasFinanceAccess({ role: 'staff', permissions: ['sales'] }), false);
      assert.strictEqual(hasFinanceAccess({ role: 'customer' }), false);
    });
  });

  describe('Time Machine & Operations Clock', () => {
    it('reads initial simulated date and advances by designated days', async () => {
      const initialDate = staffService.getTimeMachineDate();
      assert.ok(initialDate);

      const res = await staffService.advanceTimeMachine(30);
      assert.strictEqual(res.is_simulated, true);
      assert.strictEqual(res.days_advanced, 30);
      assert.ok(res.current_date > res.previous_date);
    });
  });

  describe('Sales-to-Cash Quotation Lifecycle', () => {
    it('creates a draft quotation with integer minor units and Indian GST', async () => {
      const payload = {
        customer_id: 'cust-001',
        title: 'Custom Enterprise Suite Proposal',
        valid_until: '2026-12-31',
        status: 'draft',
        discount_minor: 100000, // ₹1,000.00
        lines: [
          {
            product_name: 'Brightloop Core Enterprise Engine',
            quantity: 1,
            unit_price_minor: 1200000, // ₹12,000.00
            billing_interval: 'month',
          },
        ],
      };

      const res = await quotationService.createQuotation(payload);
      assert.ok(res.quotation);
      assert.strictEqual(res.quotation.status, 'draft');
      assert.strictEqual(res.quotation.subtotal_minor, 1200000);
      assert.strictEqual(res.quotation.discount_minor, 100000);
      // Taxable = 11,000.00 (1100000). Tax = 1100000 * 0.18 = 198000. Total = 1298000.
      assert.strictEqual(res.quotation.tax_minor, 198000);
      assert.strictEqual(res.quotation.total_minor, 1298000);
    });

    it('sends and confirms a quotation, converting it into a subscription', async () => {
      const sendRes = await quotationService.sendQuotation('qt-staff-002');
      assert.strictEqual(sendRes.success, true);
      assert.strictEqual(sendRes.quotation.status, 'quotation');

      const confirmRes = await quotationService.confirmQuotation('qt-staff-002');
      assert.strictEqual(confirmRes.success, true);
      assert.strictEqual(confirmRes.quotation.status, 'confirmed');
      assert.ok(confirmRes.subscription);
      assert.strictEqual(confirmRes.subscription.status, 'confirmed');
    });
  });

  describe('Subscription Actions & Lifecycle Transitions', () => {
    it('activates a confirmed subscription', async () => {
      const res = await subscriptionService.performStaffAction('sub-staff-108', 'activate');
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.subscription.status, 'active');
    });

    it('pauses an active subscription', async () => {
      const res = await subscriptionService.performStaffAction('sub-staff-101', 'pause');
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.subscription.status, 'paused');
    });

    it('resumes a paused subscription', async () => {
      const res = await subscriptionService.performStaffAction('sub-staff-105', 'resume');
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.subscription.status, 'active');
    });
  });

  describe('Invoice Confirmation & Credit Note Cancellation', () => {
    it('confirms a draft invoice and posts it to the ledger', async () => {
      const res = await invoiceService.confirmInvoice('inv-staff-006');
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.invoice.status, 'posted');
    });

    it('cancels an invoice with credit note voiding the balance', async () => {
      const res = await invoiceService.cancelInvoiceWithCreditNote('inv-staff-003', {
        reason: 'Service SLA Disruption Credit',
      });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.invoice.status, 'cancelled');
      assert.strictEqual(res.invoice.outstanding_minor, 0);
      assert.ok(res.credit_note);
    });
  });

  describe('Payment Collections & Strict Overpayment Prevention', () => {
    it('successfully records a valid partial payment and reduces outstanding', async () => {
      // Find an invoice with outstanding balance
      const invoice = await invoiceService.getStaffInvoice('inv-staff-001');
      assert.ok(invoice.outstanding_minor > 0);

      const payAmount = 100000; // ₹1,000.00
      const res = await paymentService.recordPayment({
        invoice_id: invoice.id,
        amount_minor: payAmount,
        payment_method: 'Bank Transfer (NEFT/RTGS)',
        transaction_reference: 'TXN-TEST-1001',
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.payment.amount_minor, payAmount);
      assert.strictEqual(res.invoice.outstanding_minor, invoice.outstanding_minor - payAmount);
    });

    it('strictly rejects overpayment exceeding outstanding balance with 422', async () => {
      const invoice = await invoiceService.getStaffInvoice('inv-staff-001');
      const overpaymentAmount = invoice.outstanding_minor + 500000; // Exceeds by ₹5,000

      await assert.rejects(
        async () => {
          await paymentService.recordPayment({
            invoice_id: invoice.id,
            amount_minor: overpaymentAmount,
            payment_method: 'UPI',
          });
        },
        (err) => {
          assert.strictEqual(err.response?.status, 422);
          assert.match(err.message, /exceeds outstanding invoice balance/i);
          return true;
        }
      );
    });

    it('rejects zero or negative payment amounts', async () => {
      await assert.rejects(
        async () => {
          await paymentService.recordPayment({
            invoice_id: 'inv-staff-001',
            amount_minor: 0,
            payment_method: 'UPI',
          });
        },
        (err) => {
          assert.strictEqual(err.response?.status, 422);
          return true;
        }
      );
    });
  });

  describe('Automated Dunning & Gateway Retries', () => {
    it('retrieves dunning overview and cases', async () => {
      const res = await dunningService.getDunningOverview();
      assert.ok(res.overview);
      assert.ok(Array.isArray(res.cases));
      assert.ok(res.overview.active_dunning_cases >= 1);
    });

    it('simulates a payment retry on an active dunning case', async () => {
      const res = await dunningService.retryAttempt('dun-001');
      assert.strictEqual(res.is_simulated, true);
      assert.ok(res.attempt);
      assert.ok(res.attempt.attempt_number >= 3);
    });

    it('generates calibrated AI reminder text across friendly, firm, and final tones', async () => {
      const friendly = await dunningService.generateAIReminder('dun-001', 'friendly');
      assert.strictEqual(friendly.tone, 'friendly');
      assert.match(friendly.subject, /Friendly reminder/i);

      const firm = await dunningService.generateAIReminder('dun-001', 'firm');
      assert.strictEqual(firm.tone, 'firm');
      assert.match(firm.subject, /Action Required/i);

      const final = await dunningService.generateAIReminder('dun-001', 'final');
      assert.strictEqual(final.tone, 'final');
      assert.match(final.subject, /Final Notice/i);
    });
  });

  describe('Automated Billing Runs', () => {
    it('executes a dry-run billing simulation without persisting invoices', async () => {
      const res = await billingService.dryRunBillingRun({
        billing_date: '2026-11-01',
      });
      assert.strictEqual(res.is_simulated, true);
      assert.ok(res.simulated_invoices_count > 0);
      assert.strictEqual(res.zero_database_mutations, true);
    });

    it('commits a live billing run generating batch invoices', async () => {
      const res = await billingService.commitBillingRun({
        billing_date: '2026-11-01',
      });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.run.status, 'committed');
      assert.ok(res.run.invoices_generated > 0);
    });
  });

  describe('Executive Finance Dashboard & MRR Movements', () => {
    it('reconciles MRR movements waterfall without discrepancy', async () => {
      const res = await financeService.getFinanceMetrics();
      const mrr = res.mrr_movements;
      assert.ok(mrr);

      const expectedClosing =
        mrr.opening_mrr_minor +
        mrr.new_mrr_minor +
        mrr.expansion_mrr_minor -
        mrr.contraction_mrr_minor -
        mrr.churn_mrr_minor;

      assert.strictEqual(mrr.closing_mrr_minor, expectedClosing);
    });
  });

  describe('Ledger Invariant Integrity Audit', () => {
    it('evaluates all 8 invariant checks to passed status', async () => {
      const res = await integrityService.runIntegrityChecks();
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.checks.length, 8);
      assert.strictEqual(res.checks.every((c) => c.status === 'passed'), true);
    });
  });
});
