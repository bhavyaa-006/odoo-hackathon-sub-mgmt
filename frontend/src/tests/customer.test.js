import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatMoney, toMinorUnits, formatDate } from '../utils/formatters.js';
import { PORTAL_CONFIG, ROUTES } from '../routes/routeConfig.js';
import subscriptionService from '../services/subscription.service.js';
import invoiceService from '../services/invoice.service.js';
import quotationService from '../services/quotation.service.js';

describe('Brightloop Phase 2: Customer Portal Tests', () => {
  describe('Financial Minor Unit Formatting (Rule: Never use floats)', () => {
    it('formats positive minor units correctly', () => {
      assert.strictEqual(formatMoney(10000, 'INR'), '₹100.00');
      assert.strictEqual(formatMoney(499900, 'INR'), '₹4,999.00');
      assert.strictEqual(formatMoney(1200000, 'INR'), '₹12,000.00');
    });

    it('formats negative minor units correctly (credits and refunds)', () => {
      assert.strictEqual(formatMoney(-2500, 'INR'), '-₹25.00');
      assert.strictEqual(formatMoney(-2500, 'INR', { parentheses: true }), '(₹25.00)');
    });

    it('handles null, undefined and invalid amounts gracefully', () => {
      assert.strictEqual(formatMoney(null), '—');
      assert.strictEqual(formatMoney(undefined), '—');
      assert.strictEqual(formatMoney('invalid'), '—');
    });

    it('converts major currency string to integer minor units without float drift', () => {
      assert.strictEqual(toMinorUnits('100.50'), 10050);
      assert.strictEqual(toMinorUnits('100'), 10000);
      assert.strictEqual(toMinorUnits('4999.00'), 499900);
      assert.strictEqual(toMinorUnits('₹1,498.82'), 149882);
    });

    it('formats ISO dates correctly into localized readable strings', () => {
      assert.strictEqual(formatDate('2026-03-31T00:00:00Z'), '31 Mar 2026');
      assert.strictEqual(formatDate(null), '—');
    });
  });

  describe('Customer Role Boundary & Access Guard', () => {
    it('Customer Portal allows strictly customer role', () => {
      const allowed = PORTAL_CONFIG.customer.allowedRoles;
      assert.strictEqual(allowed.includes('customer'), true);
      assert.strictEqual(allowed.includes('staff'), false);
      assert.strictEqual(allowed.includes('admin'), false);
    });

    it('Customer routes are scoped under /customer/*', () => {
      assert.strictEqual(ROUTES.CUSTOMER_DASHBOARD, '/customer');
      assert.strictEqual(ROUTES.CUSTOMER_SUBSCRIPTIONS, '/customer/subscriptions');
      assert.strictEqual(ROUTES.CUSTOMER_INVOICES, '/customer/invoices');
      assert.strictEqual(ROUTES.CUSTOMER_QUOTATIONS, '/customer/quotations');
      assert.strictEqual(ROUTES.CUSTOMER_NOTIFICATIONS, '/customer/notifications');
      assert.strictEqual(ROUTES.CUSTOMER_PROFILE, '/customer/profile');
    });
  });

  describe('Subscription Actions & Transitions', () => {
    it('allows pausing an active pausable subscription', async () => {
      const sub = await subscriptionService.getSubscription('sub-101');
      assert.strictEqual(sub.status, 'active');
      assert.strictEqual(sub.allowed_transitions.includes('pause'), true);
    });

    it('allows resuming a paused subscription', async () => {
      const sub = await subscriptionService.getSubscription('sub-102');
      assert.strictEqual(sub.status, 'paused');
      assert.strictEqual(sub.allowed_transitions.includes('resume'), true);
    });

    it('rejects foreign subscription IDs with 404', async () => {
      await assert.rejects(
        async () => {
          await subscriptionService.getSubscription('foreign-sub-999');
        },
        (err) => {
          assert.strictEqual(err.response?.status, 404);
          return true;
        }
      );
    });
  });

  describe('Invoice Settlement & Overpayment Protection', () => {
    it('retrieves customer invoice with exact minor unit totals', async () => {
      const inv = await invoiceService.getInvoice('inv-2026-0089');
      assert.strictEqual(inv.invoice_number, 'INV-2026-0089');
      assert.strictEqual(inv.total_minor, 589882);
      assert.strictEqual(inv.paid_minor, 440000);
      assert.strictEqual(inv.outstanding_minor, 149882);
    });

    it('rejects payments exceeding the outstanding balance', async () => {
      const inv = await invoiceService.getInvoice('inv-2026-0089');
      await assert.rejects(
        async () => {
          await invoiceService.payInvoice(inv.id, {
            amount_minor: inv.outstanding_minor + 10000, // overpayment by ₹100
          });
        },
        (err) => {
          assert.strictEqual(err.response?.status, 422);
          return true;
        }
      );
    });

    it('rejects foreign invoice IDs with 404 without data disclosure', async () => {
      await assert.rejects(
        async () => {
          await invoiceService.getInvoice('foreign-inv-999');
        },
        (err) => {
          assert.strictEqual(err.response?.status, 404);
          return true;
        }
      );
    });
  });

  describe('Quotation Expiry & Acceptance Handling', () => {
    it('prevents acceptance of already accepted quotations', async () => {
      await assert.rejects(
        async () => {
          await quotationService.acceptQuotation('qt-2026-0042');
        },
        (err) => {
          assert.strictEqual(err.message, 'Quotation already accepted');
          return true;
        }
      );
    });

    it('rejects foreign quotation IDs with 404', async () => {
      await assert.rejects(
        async () => {
          await quotationService.getQuotation('foreign-qt-999');
        },
        (err) => {
          assert.strictEqual(err.response?.status, 404);
          return true;
        }
      );
    });
  });
});
