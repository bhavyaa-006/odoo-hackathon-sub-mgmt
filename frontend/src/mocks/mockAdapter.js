/**
 * Brightloop Centralized Mock API Adapter
 *
 * Provides a client-side mock backend layer for testing the Customer Portal
 * independently of any running backend service.
 *
 * Features:
 * - Session-persisted mutable mock store.
 * - Realistic artificial network latency (150ms - 300ms) to trigger skeleton states.
 * - Comprehensive filtering, search, and detail lookups.
 * - Mutating operations: profile update, subscription actions, plan change, invoice payment, quotation acceptance, mark notification as read.
 * - Explicit simulation markers (is_simulated: true) for financial and lifecycle transactions.
 */

import { mockCustomerOverview, mockCustomerProfile } from './fixtures/customer.fixtures.js';
import { mockSubscriptions, AVAILABLE_PLANS } from './fixtures/subscriptions.fixtures.js';
import { mockQuotations } from './fixtures/quotations.fixtures.js';
import { mockInvoices } from './fixtures/invoices.fixtures.js';
import { mockNotifications } from './fixtures/notifications.fixtures.js';

// Configuration helper
export const isMockApiEnabled = () => {
  return (
    import.meta?.env?.VITE_USE_MOCK_API === 'true' ||
    import.meta?.env?.VITE_USE_MOCK_AUTH === 'true' ||
    globalThis.process?.env?.VITE_USE_MOCK_API === 'true' ||
    globalThis.process?.env?.VITE_USE_MOCK_AUTH === 'true' ||
    Boolean(globalThis.process?.execArgv?.some((arg) => arg.includes('--test')))
  );
};

// Storage helper for session-persisted mock state
const STORAGE_PREFIX = 'brightloop_mock_';

const deepClone = (val) => JSON.parse(JSON.stringify(val));

const getStored = (key, fallback) => {
  try {
    if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
      const stored = window.sessionStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (stored) return JSON.parse(stored);
    }
  } catch {
    // sessionStorage disabled or unavailable
  }
  return deepClone(fallback);
};

const setStored = (key, val) => {
  try {
    if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
      window.sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(val));
    }
  } catch {
    // sessionStorage unavailable
  }
};

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

class MockAdapter {
  constructor() {
    this.init();
  }

  init() {
    // Ensure mock store is initialized from fixtures
    if (!getStored('initialized', false)) {
      setStored('overview', mockCustomerOverview);
      setStored('profile', mockCustomerProfile);
      setStored('subscriptions', mockSubscriptions);
      setStored('quotations', mockQuotations);
      setStored('invoices', mockInvoices);
      setStored('notifications', mockNotifications);
      setStored('initialized', true);
    }
  }

  resetMockState() {
    try {
      if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
        const keys = ['overview', 'profile', 'subscriptions', 'quotations', 'invoices', 'notifications', 'initialized'];
        keys.forEach((k) => window.sessionStorage.removeItem(`${STORAGE_PREFIX}${k}`));
      }
    } catch {
      // ignore
    }
    this.init();
  }

  // --- CUSTOMER & OVERVIEW ---
  async getOverview() {
    await delay(200);
    const overview = getStored('overview', mockCustomerOverview);
    const invoices = getStored('invoices', mockInvoices);
    const quotations = getStored('quotations', mockQuotations);
    const subscriptions = getStored('subscriptions', mockSubscriptions);

    // Keep overview aggregates live with current state
    const outstanding = invoices.reduce((acc, inv) => acc + (inv.outstanding_minor || 0), 0);
    const pendingQuotes = quotations.filter((q) => q.status === 'sent').length;
    const activeSubs = subscriptions.filter((s) => s.status === 'active').length;

    return {
      ...overview,
      outstanding_balance_minor: outstanding,
      pending_quotations: pendingQuotes,
      active_subscriptions: activeSubs,
    };
  }

  async getProfile() {
    await delay(150);
    return getStored('profile', mockCustomerProfile);
  }

  async updateProfile(updatedData) {
    await delay(350);
    const current = getStored('profile', mockCustomerProfile);
    const updated = {
      ...current,
      ...updatedData,
      // Protect immutable fields
      id: current.id,
      email: current.email,
      role: current.role,
    };
    setStored('profile', updated);
    return { ...updated, is_simulated: true };
  }

  // --- SUBSCRIPTIONS ---
  async getSubscriptions({ status = 'all', search = '' } = {}) {
    await delay(200);
    let subs = getStored('subscriptions', mockSubscriptions);

    if (status && status !== 'all') {
      subs = subs.filter((s) => s.status === status);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      subs = subs.filter(
        (s) =>
          s.plan_name.toLowerCase().includes(q) ||
          s.subscription_number.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q)
      );
    }

    return deepClone(subs);
  }

  async getSubscription(id) {
    await delay(180);
    const subs = getStored('subscriptions', mockSubscriptions);
    const sub = subs.find((s) => s.id === id);

    if (!sub) {
      const err = new Error(`Subscription not found with ID ${id}`);
      err.response = { status: 404, data: { detail: 'Subscription not found' } };
      err.userMessage = 'The requested subscription could not be found.';
      throw err;
    }

    return deepClone(sub);
  }

  async performSubscriptionAction(id, action) {
    await delay(300);
    const subs = getStored('subscriptions', mockSubscriptions);
    const subIndex = subs.findIndex((s) => s.id === id);

    if (subIndex === -1) {
      const err = new Error('Subscription not found');
      err.response = { status: 404, data: { detail: 'Subscription not found' } };
      throw err;
    }

    const sub = subs[subIndex];

    if (!sub.allowed_transitions.includes(action)) {
      const err = new Error(`Action '${action}' is not permitted for subscription in status '${sub.status}'`);
      err.response = { status: 422, data: { detail: `Transition '${action}' not allowed` } };
      err.userMessage = `Action '${action}' is not permitted for status '${sub.status}'.`;
      throw err;
    }

    let newStatus = sub.status;
    let allowedTransitions = [...sub.allowed_transitions];
    const timestamp = new Date().toISOString();

    if (action === 'pause') {
      newStatus = 'paused';
      allowedTransitions = ['resume', 'cancel'];
      sub.timeline.unshift({
        id: `tl-sim-${Date.now()}`,
        event: 'Subscription Paused (Simulated)',
        timestamp,
        note: 'Customer paused subscription in mock mode.',
      });
    } else if (action === 'resume') {
      newStatus = 'active';
      allowedTransitions = ['pause', 'cancel', 'change_plan'];
      sub.timeline.unshift({
        id: `tl-sim-${Date.now()}`,
        event: 'Subscription Resumed (Simulated)',
        timestamp,
        note: 'Customer resumed active billing in mock mode.',
      });
    } else if (action === 'cancel') {
      newStatus = 'closed';
      allowedTransitions = ['renew'];
      sub.timeline.unshift({
        id: `tl-sim-${Date.now()}`,
        event: 'Subscription Cancelled (Simulated)',
        timestamp,
        note: 'Customer cancelled subscription in mock mode.',
      });
    } else if (action === 'renew') {
      newStatus = 'active';
      allowedTransitions = ['pause', 'cancel', 'change_plan'];
      sub.timeline.unshift({
        id: `tl-sim-${Date.now()}`,
        event: 'Subscription Renewed (Simulated)',
        timestamp,
        note: 'Customer renewed subscription term in mock mode.',
      });
    }

    sub.status = newStatus;
    sub.allowed_transitions = allowedTransitions;
    subs[subIndex] = sub;
    setStored('subscriptions', subs);

    return {
      success: true,
      is_simulated: true,
      subscription_id: id,
      action,
      status: newStatus,
      message: `Subscription transition to '${newStatus}' processed successfully (Mock Mode).`,
    };
  }

  async previewPlanChange(id, newPlanCode, timing = 'immediate') {
    await delay(250);
    const sub = await this.getSubscription(id);
    const targetPlan = AVAILABLE_PLANS.find((p) => p.code === newPlanCode);

    if (!targetPlan) {
      const err = new Error('Invalid plan selection');
      err.response = { status: 400, data: { detail: 'Plan not found' } };
      throw err;
    }

    const currentPrice = sub.unit_price_minor;
    const newPrice = targetPlan.unit_price_minor;
    const diff = newPrice - currentPrice;

    // Proration estimate (15 days remaining in month = 50%)
    const prorationCredit = timing === 'immediate' ? Math.round(currentPrice * 0.5) : 0;
    const prorationCharge = timing === 'immediate' ? Math.round(newPrice * 0.5) : 0;
    const netImmediateDue = Math.max(0, prorationCharge - prorationCredit);

    return {
      current_plan: {
        code: sub.plan_code,
        name: sub.plan_name,
        unit_price_minor: currentPrice,
        currency: sub.currency,
      },
      new_plan: {
        code: targetPlan.code,
        name: targetPlan.name,
        unit_price_minor: newPrice,
        currency: sub.currency,
      },
      timing,
      price_difference_minor: diff,
      unused_current_plan_credit_minor: prorationCredit,
      prorated_new_plan_charge_minor: prorationCharge,
      net_immediate_due_minor: netImmediateDue,
      currency: sub.currency,
      effective_date: timing === 'immediate' ? new Date().toISOString() : sub.next_billing_date,
      is_simulated: true,
    };
  }

  async applyPlanChange(id, { new_plan_code, timing = 'immediate' }) {
    await delay(350);
    const subs = getStored('subscriptions', mockSubscriptions);
    const subIndex = subs.findIndex((s) => s.id === id);

    if (subIndex === -1) {
      const err = new Error('Subscription not found');
      err.response = { status: 404 };
      throw err;
    }

    const targetPlan = AVAILABLE_PLANS.find((p) => p.code === new_plan_code);
    if (!targetPlan) {
      const err = new Error('Invalid plan code');
      err.response = { status: 400 };
      throw err;
    }

    const sub = subs[subIndex];
    const previousPlanName = sub.plan_name;

    sub.plan_code = targetPlan.code;
    sub.plan_name = targetPlan.name;
    sub.unit_price_minor = targetPlan.unit_price_minor;
    sub.features = targetPlan.features;

    sub.timeline.unshift({
      id: `tl-sim-${Date.now()}`,
      event: `Plan Changed to ${targetPlan.name} (Simulated)`,
      timestamp: new Date().toISOString(),
      note: `Customer switched plan tier from ${previousPlanName} (${timing}).`,
    });

    subs[subIndex] = sub;
    setStored('subscriptions', subs);

    return {
      success: true,
      is_simulated: true,
      subscription: sub,
      message: `Plan changed successfully to ${targetPlan.name} (Mock Mode).`,
    };
  }

  // --- QUOTATIONS ---
  async getQuotations({ status = 'all', search = '' } = {}) {
    await delay(200);
    let quotes = getStored('quotations', mockQuotations);

    if (status && status !== 'all') {
      quotes = quotes.filter((q) => q.status === status);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      quotes = quotes.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.quotation_number.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q)
      );
    }

    return deepClone(quotes);
  }

  async getQuotation(id) {
    await delay(180);
    const quotes = getStored('quotations', mockQuotations);
    const quote = quotes.find((q) => q.id === id);

    if (!quote) {
      const err = new Error(`Quotation not found with ID ${id}`);
      err.response = { status: 404, data: { detail: 'Quotation not found' } };
      err.userMessage = 'The requested quotation could not be found.';
      throw err;
    }

    return deepClone(quote);
  }

  async acceptQuotation(id) {
    await delay(350);
    const quotes = getStored('quotations', mockQuotations);
    const quoteIndex = quotes.findIndex((q) => q.id === id);

    if (quoteIndex === -1) {
      const err = new Error('Quotation not found');
      err.response = { status: 404, data: { detail: 'Quotation not found' } };
      throw err;
    }

    const quote = quotes[quoteIndex];

    if (quote.status === 'accepted') {
      const err = new Error('Quotation already accepted');
      err.response = { status: 400, data: { detail: 'Quotation already accepted' } };
      err.userMessage = 'This quotation has already been accepted.';
      throw err;
    }

    if (quote.status === 'expired' || new Date(quote.valid_until) < new Date()) {
      const err = new Error('Quotation has expired');
      err.response = { status: 400, data: { detail: 'Quotation has expired' } };
      err.userMessage = 'This quotation has expired and can no longer be accepted.';
      throw err;
    }

    quote.status = 'accepted';
    quote.accepted_at = new Date().toISOString();
    quotes[quoteIndex] = quote;
    setStored('quotations', quotes);

    return {
      success: true,
      is_simulated: true,
      quotation_id: id,
      message: 'Quotation accepted successfully (Mock Mode). Provisioning subscription.',
    };
  }

  // --- INVOICES & PAYMENTS ---
  async getInvoices({ status = 'all', search = '' } = {}) {
    await delay(200);
    let invoices = getStored('invoices', mockInvoices);

    if (status === 'unpaid') {
      invoices = invoices.filter((i) => (i.outstanding_minor || 0) > 0);
    } else if (status === 'paid') {
      invoices = invoices.filter((i) => i.status === 'paid' || (i.outstanding_minor || 0) === 0);
    } else if (status && status !== 'all') {
      invoices = invoices.filter((i) => i.status === status);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      invoices = invoices.filter(
        (i) =>
          i.invoice_number.toLowerCase().includes(q) ||
          i.subscription_name?.toLowerCase().includes(q) ||
          i.id.toLowerCase().includes(q)
      );
    }

    return deepClone(invoices);
  }

  async getInvoice(id) {
    await delay(180);
    const invoices = getStored('invoices', mockInvoices);
    const invoice = invoices.find((i) => i.id === id);

    if (!invoice) {
      const err = new Error(`Invoice not found with ID ${id}`);
      err.response = { status: 404, data: { detail: 'Invoice not found' } };
      err.userMessage = 'The requested invoice could not be found.';
      throw err;
    }

    return deepClone(invoice);
  }

  async payInvoice(id, { amount_minor, payment_method = 'UPI / HDFC Bank' }) {
    await delay(450);
    const invoices = getStored('invoices', mockInvoices);
    const invoiceIndex = invoices.findIndex((i) => i.id === id);

    if (invoiceIndex === -1) {
      const err = new Error('Invoice not found');
      err.response = { status: 404 };
      throw err;
    }

    const invoice = invoices[invoiceIndex];
    const amount = Number(amount_minor);

    if (!amount || amount <= 0) {
      const err = new Error('Invalid payment amount');
      err.response = { status: 422, data: { detail: 'Amount must be greater than zero' } };
      err.userMessage = 'Please enter a valid payment amount greater than ₹0.00.';
      throw err;
    }

    // Overpayment prevention check
    if (amount > invoice.outstanding_minor) {
      const err = new Error('Payment amount exceeds outstanding invoice balance');
      err.response = { status: 422, data: { detail: 'Amount exceeds balance' } };
      err.userMessage = `Payment amount exceeds the outstanding balance of ₹${(invoice.outstanding_minor / 100).toFixed(2)}.`;
      throw err;
    }

    const newPaidMinor = (invoice.paid_minor || 0) + amount;
    const newOutstandingMinor = invoice.total_minor - newPaidMinor;
    const isFullyPaid = newOutstandingMinor <= 0;

    const receipt = {
      id: `pay-sim-${Date.now()}`,
      payment_number: `PAY-SIM-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString(),
      amount_minor: amount,
      method: payment_method,
      reference: `MOCK-UPI-REF-${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      status: 'success',
      is_simulated: true,
    };

    invoice.payments = invoice.payments || [];
    invoice.payments.unshift(receipt);
    invoice.paid_minor = newPaidMinor;
    invoice.outstanding_minor = newOutstandingMinor;
    if (isFullyPaid) {
      invoice.status = 'paid';
    }

    invoices[invoiceIndex] = invoice;
    setStored('invoices', invoices);

    return {
      success: true,
      is_simulated: true,
      simulated_note: 'Simulated payment processed in Mock Mode - no real money transferred',
      invoice_id: id,
      amount_paid_minor: amount,
      remaining_outstanding_minor: newOutstandingMinor,
      is_fully_paid: isFullyPaid,
      receipt,
      message: isFullyPaid
        ? `Invoice ${invoice.invoice_number} is now fully paid (Mock Mode).`
        : `Partial payment of ₹${(amount / 100).toFixed(2)} recorded (Mock Mode).`,
    };
  }

  // --- NOTIFICATIONS ---
  async getNotifications({ filter = 'all' } = {}) {
    await delay(180);
    let notifications = getStored('notifications', mockNotifications);

    if (filter === 'unread') {
      notifications = notifications.filter((n) => !n.is_read);
    } else if (filter && filter !== 'all') {
      notifications = notifications.filter((n) => n.type === filter);
    }

    return deepClone(notifications);
  }

  async markNotificationRead(id) {
    await delay(150);
    const notifications = getStored('notifications', mockNotifications);
    const nIndex = notifications.findIndex((n) => n.id === id);

    if (nIndex !== -1) {
      notifications[nIndex].is_read = true;
      setStored('notifications', notifications);
    }

    return { success: true, notification_id: id };
  }
}

export const mockAdapter = new MockAdapter();
export default mockAdapter;
