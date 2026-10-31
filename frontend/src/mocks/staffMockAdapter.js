/**
 * Brightloop Centralized Staff Mock API Adapter
 *
 * Provides a client-side mock operations backend for the Staff Workspace.
 * Supports complete sales-to-cash workflows, simulated Time Machine clock,
 * Ask Brightloop command palette queries, and deterministic persistence in sessionStorage.
 */

import { mockStaffMembers, mockStaffCustomers } from './fixtures/staff/customers.fixtures.js';
import { mockStaffSubscriptions } from './fixtures/staff/subscriptions.fixtures.js';
import { mockStaffQuotations, mockQuotationTemplates } from './fixtures/staff/quotations.fixtures.js';
import { mockStaffInvoices } from './fixtures/staff/invoices.fixtures.js';
import { mockStaffPayments } from './fixtures/staff/payments.fixtures.js';
import { mockStaffOverdue } from './fixtures/staff/overdue.fixtures.js';
import { mockStaffDunning } from './fixtures/staff/dunning.fixtures.js';
import { mockStaffCreditNotes } from './fixtures/staff/creditNotes.fixtures.js';
import { mockStaffBillingRuns } from './fixtures/staff/billingRuns.fixtures.js';
import { mockStaffFinance } from './fixtures/staff/finance.fixtures.js';
import { mockStaffIntegrityChecks } from './fixtures/staff/integrity.fixtures.js';
import { mockStaffNotifications } from './fixtures/staff/notifications.fixtures.js';
import { mockStaffDashboard } from './fixtures/staff/dashboard.fixtures.js';
import { isMockApiEnabled } from './mockAdapter.js';

export { isMockApiEnabled };

const STORAGE_PREFIX = 'brightloop_staff_';
const deepClone = (v) => JSON.parse(JSON.stringify(v));

const getStored = (key, fallback) => {
  try {
    if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
      const stored = window.sessionStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (stored) return JSON.parse(stored);
    }
  } catch {
    // sessionStorage unavailable
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

const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms));

class StaffMockAdapter {
  constructor() {
    this.init();
  }

  init() {
    if (!getStored('initialized', false)) {
      setStored('timeMachineDate', '2026-10-31');
      setStored('customers', mockStaffCustomers);
      setStored('subscriptions', mockStaffSubscriptions);
      setStored('quotations', mockStaffQuotations);
      setStored('quotationTemplates', mockQuotationTemplates);
      setStored('invoices', mockStaffInvoices);
      setStored('payments', mockStaffPayments);
      setStored('overdue', mockStaffOverdue);
      setStored('dunning', mockStaffDunning);
      setStored('creditNotes', mockStaffCreditNotes);
      setStored('billingRuns', mockStaffBillingRuns);
      setStored('finance', mockStaffFinance);
      setStored('integrity', mockStaffIntegrityChecks);
      setStored('notifications', mockStaffNotifications);
      setStored('dashboard', mockStaffDashboard);
      setStored('initialized', true);
    }
  }

  resetStaffDemoData() {
    try {
      if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
        const keys = [
          'timeMachineDate', 'customers', 'subscriptions', 'quotations', 'quotationTemplates',
          'invoices', 'payments', 'overdue', 'dunning', 'creditNotes', 'billingRuns',
          'finance', 'integrity', 'notifications', 'dashboard', 'initialized'
        ];
        keys.forEach((k) => window.sessionStorage.removeItem(`${STORAGE_PREFIX}${k}`));
      }
    } catch {
      // ignore
    }
    this.init();
  }

  // --- TIME MACHINE ---
  getTimeMachineDate() {
    return getStored('timeMachineDate', '2026-10-31');
  }

  async advanceTimeMachine(days = 30) {
    await delay(250);
    const currentDateStr = this.getTimeMachineDate();
    const currentDate = new Date(currentDateStr);
    currentDate.setDate(currentDate.getDate() + Number(days));
    const newDateStr = currentDate.toISOString().split('T')[0];
    setStored('timeMachineDate', newDateStr);

    // Update overdue days on invoices
    const invoices = getStored('invoices', mockStaffInvoices);
    invoices.forEach((inv) => {
      if ((inv.outstanding_minor || 0) > 0 && inv.due_date < newDateStr) {
        const diffMs = new Date(newDateStr).getTime() - new Date(inv.due_date).getTime();
        inv.days_overdue = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      }
    });
    setStored('invoices', invoices);

    return {
      previous_date: currentDateStr,
      current_date: newDateStr,
      days_advanced: days,
      message: `Time Machine advanced by +${days} days to ${newDateStr} (Simulated Clock).`,
      is_simulated: true,
    };
  }

  // --- ASK BRIGHTLOOP SEARCH & AI ---
  async searchAll(query = '') {
    await delay(120);
    const q = (query || '').trim().toLowerCase();
    if (!q) return { results: [] };

    const customers = getStored('customers', mockStaffCustomers);
    const subscriptions = getStored('subscriptions', mockStaffSubscriptions);
    const invoices = getStored('invoices', mockStaffInvoices);
    const quotations = getStored('quotations', mockStaffQuotations);

    const results = [];

    // Search Customers
    customers.forEach((c) => {
      if (c.name.toLowerCase().includes(q) || c.company_name.toLowerCase().includes(q) || c.customer_number.toLowerCase().includes(q)) {
        results.push({
          type: 'Customer',
          title: c.name,
          subtitle: `${c.company_name} • ${c.customer_number}`,
          link: `/staff/customers/${c.id}`,
        });
      }
    });

    // Search Invoices
    invoices.forEach((inv) => {
      if (inv.invoice_number.toLowerCase().includes(q) || inv.customer_name.toLowerCase().includes(q)) {
        results.push({
          type: 'Invoice',
          title: inv.invoice_number,
          subtitle: `${inv.customer_company} • ₹${(inv.total_minor / 100).toFixed(2)} (${inv.status})`,
          link: `/staff/invoices/${inv.id}`,
        });
      }
    });

    // Search Subscriptions
    subscriptions.forEach((s) => {
      if (s.subscription_number.toLowerCase().includes(q) || s.plan_name.toLowerCase().includes(q) || s.customer_name.toLowerCase().includes(q)) {
        results.push({
          type: 'Subscription',
          title: s.subscription_number,
          subtitle: `${s.plan_name} • ${s.customer_name} (${s.status})`,
          link: `/staff/subscriptions/${s.id}`,
        });
      }
    });

    // Search Quotations
    quotations.forEach((qt) => {
      if (qt.quotation_number.toLowerCase().includes(q) || qt.title.toLowerCase().includes(q) || qt.customer_name.toLowerCase().includes(q)) {
        results.push({
          type: 'Quotation',
          title: qt.quotation_number,
          subtitle: `${qt.title} • ₹${(qt.total_minor / 100).toFixed(2)}`,
          link: `/staff/quotations/${qt.id}`,
        });
      }
    });

    return { results: results.slice(0, 10) };
  }

  async askAI(question = '') {
    await delay(350);
    const q = (question || '').toLowerCase();
    const finance = getStored('finance', mockStaffFinance);
    const overdue = getStored('overdue', mockStaffOverdue);

    if (q.includes('overdue') || q.includes('exposure') || q.includes('unpaid')) {
      return {
        question,
        explanation: `Total overdue exposure stands at ₹${(overdue.summary.total_overdue_amount_minor / 100).toFixed(2)} across ${overdue.summary.total_overdue_invoices} accounts. 100% of overdue accounts are within the 1-30 day aging bracket. The primary dunning cases are Kaviar Embedded (16 days overdue) and Malabar Cognition (15 days overdue).`,
        metrics: [
          { label: 'Total Overdue', value: `₹${(overdue.summary.total_overdue_amount_minor / 100).toFixed(2)}` },
          { label: 'Overdue Accounts', value: String(overdue.summary.total_overdue_invoices) },
          { label: 'Avg Overdue Age', value: `${overdue.summary.average_days_overdue} days` },
        ],
        action_link: '/staff/overdue',
        action_label: 'View Overdue Dashboard',
        is_simulated: true,
      };
    }

    if (q.includes('mrr') || q.includes('revenue') || q.includes('growth')) {
      return {
        question,
        explanation: `Current normalized Monthly Recurring Revenue (MRR) is ₹${(finance.kpis.mrr_minor / 100).toFixed(2)} with a +${finance.kpis.mrr_growth_pct}% MoM expansion rate. October net new MRR was driven by 2 new enterprise contracts (+₹58,000) and multi-store retail expansion (+₹19,000).`,
        metrics: [
          { label: 'Current MRR', value: `₹${(finance.kpis.mrr_minor / 100).toFixed(2)}` },
          { label: 'Collection Rate', value: `${finance.kpis.collection_rate_pct}%` },
          { label: 'Active Subscriptions', value: String(finance.kpis.active_subscriptions) },
        ],
        action_link: '/staff/finance',
        action_label: 'View Finance Dashboard',
        is_simulated: true,
      };
    }

    return {
      question,
      explanation: `Brightloop Operations Assistant: Operational metrics are healthy. 14 active subscriptions generating ₹4,85,000.00 MRR with 86.8% payment collection efficiency. 2 pending quotations (₹1,53,990.00 pipeline) and 4 accounts in follow-up.`,
      metrics: [
        { label: 'Active Subscriptions', value: '14' },
        { label: 'Pipeline Value', value: '₹1,53,990.00' },
        { label: 'Recoveries This Month', value: '8 cases' },
      ],
      action_link: '/staff',
      action_label: 'Return to Operations Dashboard',
      is_simulated: true,
    };
  }

  // --- STAFF DASHBOARD ---
  async getDashboard() {
    await delay(180);
    const dashboard = getStored('dashboard', mockStaffDashboard);
    const customers = getStored('customers', mockStaffCustomers);
    const subscriptions = getStored('subscriptions', mockStaffSubscriptions);
    const quotations = getStored('quotations', mockStaffQuotations);
    const invoices = getStored('invoices', mockStaffInvoices);

    const pendingQuotes = quotations.filter((q) => q.status === 'quotation' || q.status === 'pending').length;
    const activeSubs = subscriptions.filter((s) => s.status === 'active').length;
    const overdueInvs = invoices.filter((i) => (i.outstanding_minor || 0) > 0 && i.due_date < this.getTimeMachineDate());

    return {
      ...dashboard,
      kpis: {
        ...dashboard.kpis,
        assigned_customers_count: customers.length,
        active_subscriptions_count: activeSubs,
        pending_quotations_count: pendingQuotes,
        overdue_invoices_count: overdueInvs.length,
      },
    };
  }

  // --- CUSTOMERS ---
  async getCustomers({ search = '', status = 'all', staffId = 'all', page = 1, limit = 10 } = {}) {
    await delay(180);
    let list = getStored('customers', mockStaffCustomers);

    if (status && status !== 'all') {
      list = list.filter((c) => c.status === status);
    }

    if (staffId && staffId !== 'all') {
      list = list.filter((c) => c.assigned_staff_id === staffId);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.company_name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.customer_number.toLowerCase().includes(q)
      );
    }

    const total = list.length;
    const startIndex = (page - 1) * limit;
    const paginated = list.slice(startIndex, startIndex + limit);

    return {
      customers: deepClone(paginated),
      total,
      page: Number(page),
      limit: Number(limit),
      total_pages: Math.ceil(total / limit) || 1,
      staff_members: mockStaffMembers,
    };
  }

  async getCustomer(id) {
    await delay(150);
    const customers = getStored('customers', mockStaffCustomers);
    const customer = customers.find((c) => c.id === id);

    if (!customer) {
      const err = new Error(`Customer not found with ID ${id}`);
      err.response = { status: 404, data: { detail: 'Customer not found' } };
      err.userMessage = 'Customer not found.';
      throw err;
    }

    const subscriptions = getStored('subscriptions', mockStaffSubscriptions).filter((s) => s.customer_id === id);
    const quotations = getStored('quotations', mockStaffQuotations).filter((q) => q.customer_id === id);
    const invoices = getStored('invoices', mockStaffInvoices).filter((i) => i.customer_id === id);
    const payments = getStored('payments', mockStaffPayments).filter((p) => p.customer_id === id);

    const activity = [
      { id: 'act-c-1', date: customer.created_at, title: 'Customer Account Created', description: `Registered as ${customer.name} under ${customer.company_name}` },
      ...subscriptions.map((s) => ({ id: `act-s-${s.id}`, date: s.start_date, title: `Subscription ${s.subscription_number}`, description: `${s.plan_name} (${s.status})` })),
      ...invoices.map((inv) => ({ id: `act-i-${inv.id}`, date: inv.issue_date, title: `Invoice ${inv.invoice_number}`, description: `Billed ₹${(inv.total_minor / 100).toFixed(2)} (${inv.status})` })),
      ...payments.map((p) => ({ id: `act-p-${p.id}`, date: p.payment_date, title: `Payment ${p.payment_reference}`, description: `Settled ₹${(p.amount_minor / 100).toFixed(2)} via ${p.payment_method}` })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      customer: deepClone(customer),
      subscriptions: deepClone(subscriptions),
      quotations: deepClone(quotations),
      invoices: deepClone(invoices),
      payments: deepClone(payments),
      activity,
      staff_members: mockStaffMembers,
    };
  }

  async assignCustomerStaff(customerId, staffId) {
    await delay(250);
    const customers = getStored('customers', mockStaffCustomers);
    const index = customers.findIndex((c) => c.id === customerId);
    if (index === -1) {
      const err = new Error('Customer not found');
      err.response = { status: 404 };
      throw err;
    }

    const staff = mockStaffMembers.find((s) => s.id === staffId);
    customers[index].assigned_staff_id = staff ? staff.id : null;
    customers[index].assigned_staff_name = staff ? staff.name : 'Unassigned';
    setStored('customers', customers);

    return {
      success: true,
      customer: customers[index],
      message: `Customer assigned to ${staff ? staff.name : 'Unassigned'} (Simulated).`,
      is_simulated: true,
    };
  }

  // --- QUOTATIONS ---
  async getQuotations({ search = '', status = 'all' } = {}) {
    await delay(180);
    let quotes = getStored('quotations', mockStaffQuotations);

    if (status && status !== 'all') {
      quotes = quotes.filter((q) => q.status === status);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      quotes = quotes.filter(
        (item) =>
          item.quotation_number.toLowerCase().includes(q) ||
          item.title.toLowerCase().includes(q) ||
          item.customer_name.toLowerCase().includes(q) ||
          item.customer_company.toLowerCase().includes(q)
      );
    }

    return deepClone(quotes);
  }

  async getQuotationTemplates() {
    await delay(120);
    return deepClone(getStored('quotationTemplates', mockQuotationTemplates));
  }

  async getQuotation(id) {
    await delay(150);
    const quotes = getStored('quotations', mockStaffQuotations);
    const quote = quotes.find((q) => q.id === id);

    if (!quote) {
      const err = new Error(`Quotation not found with ID ${id}`);
      err.response = { status: 404 };
      err.userMessage = 'Quotation not found.';
      throw err;
    }

    return deepClone(quote);
  }

  async createQuotation(data) {
    await delay(350);
    const quotes = getStored('quotations', mockStaffQuotations);
    const customers = getStored('customers', mockStaffCustomers);
    const customer = customers.find((c) => c.id === data.customer_id) || customers[0];

    const subtotal = (data.lines || []).reduce((acc, l) => acc + (Number(l.unit_price_minor || 0) * Number(l.quantity || 1)), 0);
    const discount = Number(data.discount_minor || 0);
    const taxable = Math.max(0, subtotal - discount);
    const tax = Math.round(taxable * 0.18); // 18% GST
    const total = taxable + tax;

    const newQuotation = {
      id: `qt-staff-${Date.now()}`,
      quotation_number: `QT-2026-${Math.floor(10000 + Math.random() * 90000)}`,
      title: data.title || 'Custom Subscription Proposal',
      customer_id: customer.id,
      customer_name: customer.name,
      customer_company: customer.company_name,
      customer_email: customer.email,
      created_date: this.getTimeMachineDate(),
      created_at: new Date().toISOString(),
      valid_until: data.valid_until || '2026-11-30',
      status: data.status === 'draft' || data.is_draft ? 'draft' : 'quotation',
      currency: 'INR',
      assigned_staff_id: data.assigned_staff_id || 'usr-staff-1',
      assigned_staff_name: 'Sarah Chen',
      template_id: data.template_id || null,
      subtotal_minor: subtotal,
      discount_minor: discount,
      taxable_amount_minor: taxable,
      tax_minor: tax,
      total_minor: total,
      terms: data.terms || 'Payment due within Net 15 days of acceptance. Includes standard SLA.',
      lines: data.lines || [],
      is_simulated: true,
    };

    quotes.unshift(newQuotation);
    setStored('quotations', quotes);

    return {
      success: true,
      quotation: newQuotation,
      message: `Quotation ${newQuotation.quotation_number} created successfully (Mock Mode).`,
      is_simulated: true,
    };
  }

  async sendQuotation(id) {
    await delay(250);
    const quotes = getStored('quotations', mockStaffQuotations);
    const index = quotes.findIndex((q) => q.id === id);
    if (index === -1) throw new Error('Quotation not found');

    quotes[index].status = 'quotation';
    setStored('quotations', quotes);

    return {
      success: true,
      quotation: quotes[index],
      message: `Quotation ${quotes[index].quotation_number} dispatched to customer email.`,
      is_simulated: true,
    };
  }

  async confirmQuotation(id) {
    await delay(350);
    const quotes = getStored('quotations', mockStaffQuotations);
    const index = quotes.findIndex((q) => q.id === id);
    if (index === -1) throw new Error('Quotation not found');

    const quote = quotes[index];
    quote.status = 'confirmed';
    quote.accepted_at = new Date().toISOString();

    // Create corresponding subscription
    const subs = getStored('subscriptions', mockStaffSubscriptions);
    const newSub = {
      id: `sub-staff-${Date.now()}`,
      subscription_number: `SUB-2026-${Math.floor(10000 + Math.random() * 90000)}`,
      customer_id: quote.customer_id,
      customer_name: quote.customer_name,
      customer_company: quote.customer_company,
      plan_code: 'enterprise-custom',
      plan_name: quote.title,
      billing_frequency: 'annual',
      status: 'confirmed',
      amount_minor: quote.total_minor,
      currency: 'INR',
      start_date: this.getTimeMachineDate(),
      expiry_date: null,
      next_billing_date: this.getTimeMachineDate(),
      payment_terms: 'Net 15',
      auto_renew: true,
      allowed_transitions: ['activate', 'cancel'],
      lines: quote.lines,
      history: [
        { id: `sth-${Date.now()}`, event_type: 'converted_from_quotation', title: `Converted from Quotation ${quote.quotation_number}`, timestamp: new Date().toISOString() },
      ],
      is_simulated: true,
    };
    subs.unshift(newSub);
    setStored('subscriptions', subs);

    quote.converted_subscription_id = newSub.id;
    setStored('quotations', quotes);

    return {
      success: true,
      quotation: quote,
      subscription: newSub,
      message: `Quotation confirmed! Generated subscription ${newSub.subscription_number} (Mock Mode).`,
      is_simulated: true,
    };
  }

  // --- SUBSCRIPTIONS ---
  async getSubscriptions({ search = '', status = 'all' } = {}) {
    await delay(180);
    let subs = getStored('subscriptions', mockStaffSubscriptions);

    if (status && status !== 'all') {
      subs = subs.filter((s) => s.status === status);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      subs = subs.filter(
        (s) =>
          s.subscription_number.toLowerCase().includes(q) ||
          s.plan_name.toLowerCase().includes(q) ||
          s.customer_name.toLowerCase().includes(q) ||
          s.customer_company.toLowerCase().includes(q)
      );
    }

    return deepClone(subs);
  }

  async getSubscription(id) {
    await delay(150);
    const subs = getStored('subscriptions', mockStaffSubscriptions);
    const sub = subs.find((s) => s.id === id);

    if (!sub) {
      const err = new Error(`Subscription not found with ID ${id}`);
      err.response = { status: 404 };
      err.userMessage = 'Subscription not found.';
      throw err;
    }

    return deepClone(sub);
  }

  async performSubscriptionAction(id, action) {
    await delay(300);
    const subs = getStored('subscriptions', mockStaffSubscriptions);
    const index = subs.findIndex((s) => s.id === id);
    if (index === -1) throw new Error('Subscription not found');

    const sub = subs[index];
    const timestamp = new Date().toISOString();
    let newStatus = sub.status;
    let allowed = [...sub.allowed_transitions];

    if (action === 'activate') {
      newStatus = 'active';
      allowed = ['pause', 'cancel', 'change_plan'];
      sub.history.unshift({ id: `ev-${Date.now()}`, event_type: 'activated', title: 'Subscription Activated by Staff', timestamp });
    } else if (action === 'pause') {
      newStatus = 'paused';
      allowed = ['resume', 'cancel'];
      sub.history.unshift({ id: `ev-${Date.now()}`, event_type: 'paused', title: 'Subscription Paused by Staff', timestamp });
    } else if (action === 'resume') {
      newStatus = 'active';
      allowed = ['pause', 'cancel', 'change_plan'];
      sub.history.unshift({ id: `ev-${Date.now()}`, event_type: 'resumed', title: 'Subscription Resumed by Staff', timestamp });
    } else if (action === 'renew') {
      newStatus = 'active';
      allowed = ['pause', 'cancel', 'change_plan'];
      sub.history.unshift({ id: `ev-${Date.now()}`, event_type: 'renewed', title: 'Subscription Renewed for Additional Cycle', timestamp });
    } else if (action === 'cancel' || action === 'close') {
      newStatus = 'closed';
      allowed = ['renew'];
      sub.history.unshift({ id: `ev-${Date.now()}`, event_type: 'closed', title: 'Subscription Closed / Cancelled', timestamp });
    }

    sub.status = newStatus;
    sub.allowed_transitions = allowed;
    subs[index] = sub;
    setStored('subscriptions', subs);

    return {
      success: true,
      subscription: sub,
      message: `Subscription transition to '${newStatus}' completed (Mock Mode).`,
      is_simulated: true,
    };
  }

  // --- INVOICES ---
  async getInvoices({ search = '', status = 'all' } = {}) {
    await delay(180);
    let invoices = getStored('invoices', mockStaffInvoices);

    if (status && status !== 'all') {
      if (status === 'overdue') {
        invoices = invoices.filter((i) => (i.outstanding_minor || 0) > 0 && i.due_date < this.getTimeMachineDate());
      } else {
        invoices = invoices.filter((i) => i.status === status);
      }
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      invoices = invoices.filter(
        (i) =>
          i.invoice_number.toLowerCase().includes(q) ||
          i.customer_name.toLowerCase().includes(q) ||
          i.customer_company.toLowerCase().includes(q)
      );
    }

    return deepClone(invoices);
  }

  async getInvoice(id) {
    await delay(150);
    const invoices = getStored('invoices', mockStaffInvoices);
    const invoice = invoices.find((i) => i.id === id);

    if (!invoice) {
      const err = new Error(`Invoice not found with ID ${id}`);
      err.response = { status: 404 };
      err.userMessage = 'Invoice not found.';
      throw err;
    }

    return deepClone(invoice);
  }

  async confirmInvoice(id) {
    await delay(250);
    const invoices = getStored('invoices', mockStaffInvoices);
    const index = invoices.findIndex((i) => i.id === id);
    if (index === -1) throw new Error('Invoice not found');

    invoices[index].status = 'posted';
    setStored('invoices', invoices);

    return {
      success: true,
      invoice: invoices[index],
      message: `Invoice ${invoices[index].invoice_number} confirmed and posted to ledger.`,
      is_simulated: true,
    };
  }

  async cancelInvoiceWithCreditNote(id, { reason = 'Customer requested cancellation', notes = '' }) {
    await delay(350);
    const invoices = getStored('invoices', mockStaffInvoices);
    const index = invoices.findIndex((i) => i.id === id);
    if (index === -1) throw new Error('Invoice not found');

    const invoice = invoices[index];
    invoice.status = 'cancelled';

    // Issue offsetting credit note
    const creditNotes = getStored('creditNotes', mockStaffCreditNotes);
    const newCN = {
      id: `cn-staff-${Date.now()}`,
      credit_note_number: `CN-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      original_invoice_id: invoice.id,
      original_invoice_number: invoice.invoice_number,
      customer_id: invoice.customer_id,
      customer_name: invoice.customer_name,
      customer_company: invoice.customer_company,
      issue_date: this.getTimeMachineDate(),
      amount_minor: invoice.subtotal_minor,
      tax_adjustment_minor: invoice.tax_minor,
      total_credit_minor: invoice.total_minor,
      applied_amount_minor: invoice.total_minor,
      remaining_credit_minor: 0,
      status: 'fully_applied',
      reason,
      notes,
      created_by: 'Sarah Chen',
      created_at: new Date().toISOString(),
      is_simulated: true,
    };
    creditNotes.unshift(newCN);
    setStored('creditNotes', creditNotes);

    invoice.outstanding_minor = 0;
    setStored('invoices', invoices);

    return {
      success: true,
      invoice,
      credit_note: newCN,
      message: `Invoice cancelled. Offset Credit Note ${newCN.credit_note_number} generated (Mock Mode).`,
      is_simulated: true,
    };
  }

  // --- PAYMENTS ---
  async getPayments({ search = '', method = 'all', status = 'all' } = {}) {
    await delay(180);
    let payments = getStored('payments', mockStaffPayments);

    if (method && method !== 'all') {
      payments = payments.filter((p) => p.payment_method.toLowerCase().includes(method.toLowerCase()));
    }

    if (status && status !== 'all') {
      payments = payments.filter((p) => p.status === status);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      payments = payments.filter(
        (p) =>
          p.payment_reference.toLowerCase().includes(q) ||
          p.customer_name.toLowerCase().includes(q) ||
          p.customer_company.toLowerCase().includes(q) ||
          p.invoice_number.toLowerCase().includes(q)
      );
    }

    return deepClone(payments);
  }

  async getPayment(id) {
    await delay(150);
    const payments = getStored('payments', mockStaffPayments);
    const payment = payments.find((p) => p.id === id);

    if (!payment) {
      const err = new Error(`Payment not found with ID ${id}`);
      err.response = { status: 404 };
      err.userMessage = 'Payment record not found.';
      throw err;
    }

    return deepClone(payment);
  }

  async recordPayment(data) {
    await delay(400);
    const invoices = getStored('invoices', mockStaffInvoices);
    const payments = getStored('payments', mockStaffPayments);

    const invoice = invoices.find((i) => i.id === data.invoice_id);
    if (!invoice) {
      const err = new Error('Invoice not found');
      err.response = { status: 404 };
      throw err;
    }

    const payAmountMinor = Number(data.amount_minor);
    if (!payAmountMinor || payAmountMinor <= 0) {
      const err = new Error('Payment amount must be greater than zero.');
      err.response = { status: 422 };
      err.userMessage = 'Payment amount must be greater than zero.';
      throw err;
    }

    // Overpayment prevention rule
    if (payAmountMinor > invoice.outstanding_minor) {
      const err = new Error('Payment amount exceeds outstanding invoice balance');
      err.response = { status: 422 };
      err.userMessage = `Payment amount exceeds outstanding invoice balance of ₹${(invoice.outstanding_minor / 100).toFixed(2)}.`;
      throw err;
    }

    invoice.paid_minor = (invoice.paid_minor || 0) + payAmountMinor;
    invoice.outstanding_minor = invoice.total_minor - invoice.paid_minor;
    if (invoice.outstanding_minor <= 0) {
      invoice.status = 'paid';
    }

    const newPayment = {
      id: `pay-staff-${Date.now()}`,
      payment_reference: `PAY-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      customer_id: invoice.customer_id,
      customer_name: invoice.customer_name,
      customer_company: invoice.customer_company,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      amount_minor: payAmountMinor,
      currency: invoice.currency,
      payment_date: data.payment_date || new Date().toISOString(),
      payment_method: data.payment_method || 'Bank Transfer (NEFT/RTGS)',
      transaction_reference: data.transaction_reference || `TXN-STAFF-${Date.now().toString().slice(-6)}`,
      status: 'completed',
      recorded_by: 'Sarah Chen',
      notes: data.notes || 'Recorded via Staff Workspace payment intake.',
      is_simulated: true,
    };

    payments.unshift(newPayment);
    setStored('payments', payments);
    setStored('invoices', invoices);

    return {
      success: true,
      payment: newPayment,
      invoice,
      message: `Payment of ₹${(payAmountMinor / 100).toFixed(2)} recorded successfully against ${invoice.invoice_number} (Mock Mode).`,
      is_simulated: true,
    };
  }

  // --- OVERDUE & AGING ---
  async getOverdueSummary() {
    await delay(180);
    const overdue = getStored('overdue', mockStaffOverdue);
    const invoices = getStored('invoices', mockStaffInvoices);
    const overdueList = invoices.filter((i) => (i.outstanding_minor || 0) > 0 && i.due_date < this.getTimeMachineDate());

    const totalOverdueMinor = overdueList.reduce((acc, i) => acc + i.outstanding_minor, 0);

    return {
      summary: {
        ...overdue.summary,
        total_overdue_invoices: overdueList.length,
        total_overdue_amount_minor: totalOverdueMinor,
      },
      aging_buckets: overdue.aging_buckets,
      invoices: deepClone(overdueList),
    };
  }

  // --- DUNNING ---
  async getDunningOverview() {
    await delay(180);
    return deepClone(getStored('dunning', mockStaffDunning));
  }

  async getDunningCase(id) {
    await delay(150);
    const dunning = getStored('dunning', mockStaffDunning);
    const c = dunning.cases.find((item) => item.id === id);
    if (!c) {
      const err = new Error('Dunning case not found');
      err.response = { status: 404 };
      throw err;
    }
    return deepClone(c);
  }

  async retryDunningAttempt(id) {
    await delay(450);
    const dunning = getStored('dunning', mockStaffDunning);
    const c = dunning.cases.find((item) => item.id === id);
    if (!c) throw new Error('Dunning case not found');

    const newAttempt = {
      id: `att-sim-${Date.now()}`,
      attempt_number: c.retry_count + 1,
      date: new Date().toISOString(),
      gateway: 'Razorpay / HDFC (Simulated Retry)',
      amount_minor: c.outstanding_amount_minor,
      result: 'declined', // Consistent simulation: requires customer card renewal
      error_code: 'INSUFFICIENT_FUNDS',
      error_message: 'Simulated payment retry executed. Card declined by issuing bank.',
    };

    c.retry_count += 1;
    c.attempts.unshift(newAttempt);
    c.last_attempt_date = newAttempt.date;
    setStored('dunning', dunning);

    return {
      success: true,
      case: c,
      attempt: newAttempt,
      message: `Simulated retry executed for case ${c.case_number}. Gateway response: Declined.`,
      is_simulated: true,
    };
  }

  async generateAIReminder(id, tone = 'friendly') {
    await delay(300);
    const dunning = getStored('dunning', mockStaffDunning);
    const c = dunning.cases.find((item) => item.id === id);
    if (!c) throw new Error('Dunning case not found');

    const template = c.ai_reminders?.[tone] || c.ai_reminders?.friendly;
    return {
      ...template,
      is_simulated: true,
    };
  }

  // --- CREDIT NOTES ---
  async getCreditNotes() {
    await delay(180);
    return deepClone(getStored('creditNotes', mockStaffCreditNotes));
  }

  async getCreditNote(id) {
    await delay(150);
    const notes = getStored('creditNotes', mockStaffCreditNotes);
    const cn = notes.find((item) => item.id === id);
    if (!cn) {
      const err = new Error('Credit Note not found');
      err.response = { status: 404 };
      throw err;
    }
    return deepClone(cn);
  }

  async createCreditNote(data) {
    await delay(350);
    const notes = getStored('creditNotes', mockStaffCreditNotes);
    const invoices = getStored('invoices', mockStaffInvoices);
    const invoice = invoices.find((i) => i.id === data.invoice_id) || invoices[0];

    const amountMinor = Number(data.amount_minor || 100000);
    const taxMinor = Math.round(amountMinor * 0.18);
    const totalCreditMinor = amountMinor + taxMinor;

    const newCN = {
      id: `cn-staff-${Date.now()}`,
      credit_note_number: `CN-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      original_invoice_id: invoice.id,
      original_invoice_number: invoice.invoice_number,
      customer_id: invoice.customer_id,
      customer_name: invoice.customer_name,
      customer_company: invoice.customer_company,
      customer_gstin: invoice.customer_gstin,
      issue_date: this.getTimeMachineDate(),
      amount_minor: amountMinor,
      tax_adjustment_minor: taxMinor,
      total_credit_minor: totalCreditMinor,
      applied_amount_minor: 0,
      remaining_credit_minor: totalCreditMinor,
      status: 'issued',
      reason: data.reason || 'Service adjustment credit note',
      notes: data.notes || '',
      created_by: 'Sarah Chen',
      created_at: new Date().toISOString(),
      lines: [
        {
          id: `cnl-${Date.now()}`,
          description: data.reason || 'Invoice line credit adjustment',
          quantity: 1,
          unit_price_minor: amountMinor,
          tax_rate: '18%',
          tax_minor: taxMinor,
          line_total_minor: totalCreditMinor,
        },
      ],
      is_simulated: true,
    };

    notes.unshift(newCN);
    setStored('creditNotes', notes);

    return {
      success: true,
      credit_note: newCN,
      message: `Credit Note ${newCN.credit_note_number} generated for ₹${(totalCreditMinor / 100).toFixed(2)} (Mock Mode).`,
      is_simulated: true,
    };
  }

  async applyCreditNote(cnId, invoiceId, amountMinor) {
    await delay(350);
    const notes = getStored('creditNotes', mockStaffCreditNotes);
    const invoices = getStored('invoices', mockStaffInvoices);

    const cn = notes.find((n) => n.id === cnId);
    const inv = invoices.find((i) => i.id === invoiceId);

    if (!cn || !inv) throw new Error('Credit Note or Invoice not found');

    const applyAmount = Math.min(Number(amountMinor), cn.remaining_credit_minor, inv.outstanding_minor);
    cn.applied_amount_minor += applyAmount;
    cn.remaining_credit_minor -= applyAmount;
    if (cn.remaining_credit_minor === 0) cn.status = 'fully_applied';
    else cn.status = 'partially_applied';

    inv.paid_minor += applyAmount;
    inv.outstanding_minor -= applyAmount;
    if (inv.outstanding_minor === 0) inv.status = 'paid';

    setStored('creditNotes', notes);
    setStored('invoices', invoices);

    return {
      success: true,
      credit_note: cn,
      invoice: inv,
      applied_amount_minor: applyAmount,
      message: `Credit of ₹${(applyAmount / 100).toFixed(2)} applied against ${inv.invoice_number}.`,
      is_simulated: true,
    };
  }

  // --- BILLING RUNS ---
  async getBillingRuns() {
    await delay(180);
    return deepClone(getStored('billingRuns', mockStaffBillingRuns));
  }

  async getBillingRun(id) {
    await delay(150);
    const runs = getStored('billingRuns', mockStaffBillingRuns);
    const r = runs.find((item) => item.id === id);
    if (!r) {
      const err = new Error('Billing run not found');
      err.response = { status: 404 };
      throw err;
    }
    return deepClone(r);
  }

  async previewBillingRun({ billing_date = '2026-11-01', billing_period = '01 Nov 2026 – 30 Nov 2026' }) {
    await delay(350);
    return {
      billing_date,
      billing_period,
      status: 'preview',
      total_subscriptions_scanned: 20,
      eligible_subscriptions_count: 9,
      expected_invoice_count: 9,
      expected_total_amount_minor: 21500000, // ₹2,15,000.00
      skipped_subscriptions_count: 11,
      anomalies_detected: 0,
      eligible_items: [
        { subscription_number: 'SUB-2026-00108', customer_name: 'Meera Iyer', plan_name: 'Brightloop Growth Edition', amount_minor: 499900 },
        { subscription_number: 'SUB-2026-00103', customer_name: 'Ananya Deshmukh', plan_name: 'Brightloop Growth Edition', amount_minor: 999900 },
      ],
      skipped_items: [
        { subscription_number: 'SUB-2026-00101', customer_name: 'Alex Mercer', reason: 'Billing day is 15th' },
        { subscription_number: 'SUB-2026-00102', customer_name: 'Rohan Sharma', reason: 'Annual interval' },
        { subscription_number: 'SUB-2026-00105', customer_name: 'Suresh Menon', reason: 'Subscription paused' },
      ],
      is_simulated: true,
    };
  }

  async dryRunBillingRun(data) {
    await delay(450);
    return {
      run_type: 'dry_run',
      billing_date: data.billing_date || '2026-11-01',
      simulated_invoices_count: 9,
      simulated_total_minor: 21500000,
      zero_database_mutations: true,
      message: 'DRY RUN COMPLETE: 9 invoices simulated (₹2,15,000.00). No actual records or invoices were created.',
      is_simulated: true,
    };
  }

  async commitBillingRun(data) {
    await delay(600);
    const runs = getStored('billingRuns', mockStaffBillingRuns);
    const newRun = {
      id: `brun-${Date.now()}`,
      run_number: `RUN-2026-COMMIT-${Math.floor(100 + Math.random() * 900)}`,
      run_date: new Date().toISOString(),
      billing_date: data.billing_date || '2026-11-01',
      billing_period: data.billing_period || '01 Nov 2026 – 30 Nov 2026',
      total_subscriptions_processed: 20,
      eligible_subscriptions: 9,
      invoices_generated: 9,
      skipped_subscriptions: 11,
      failed_items: 0,
      total_amount_minor: 21500000,
      status: 'committed',
      execution_type: 'manual_commit',
      executed_by: 'Sarah Chen',
      summary: 'Manual staff commit executed successfully. 9 invoices generated and added to ledger.',
      eligible_list: [],
      skipped_list: [],
      failed_list: [],
      is_simulated: true,
    };

    runs.unshift(newRun);
    setStored('billingRuns', runs);

    return {
      success: true,
      run: newRun,
      message: `Billing run committed! 9 invoices generated totaling ₹2,15,000.00 (Mock Mode).`,
      is_simulated: true,
    };
  }

  async retryBillingRunItem(runId, itemId) {
    await delay(300);
    return {
      success: true,
      item_id: itemId,
      status: 'resolved',
      message: `Item ${itemId} reprocessed successfully. Tax classification applied.`,
      is_simulated: true,
    };
  }

  // --- FINANCE DASHBOARD ---
  async getFinanceMetrics() {
    await delay(200);
    return deepClone(getStored('finance', mockStaffFinance));
  }

  // --- INTEGRITY CHECKS ---
  async getIntegrityChecks() {
    await delay(180);
    return deepClone(getStored('integrity', mockStaffIntegrityChecks));
  }

  async runIntegrityChecks() {
    await delay(500);
    const checks = getStored('integrity', mockStaffIntegrityChecks);
    const timestamp = new Date().toISOString();
    checks.forEach((chk) => {
      chk.last_executed = timestamp;
      chk.status = 'passed';
      chk.failure_count = 0;
    });
    setStored('integrity', checks);

    return {
      success: true,
      checks,
      passed_count: checks.length,
      warning_count: 0,
      failed_count: 0,
      execution_time_ms: 482,
      timestamp,
      message: `All 8 financial & subscription invariants verified. Zero anomalies found (Mock Mode).`,
      is_simulated: true,
    };
  }

  // --- NOTIFICATIONS OUTBOX ---
  async getStaffNotifications({ type = 'all', status = 'all' } = {}) {
    await delay(180);
    let list = getStored('notifications', mockStaffNotifications);

    if (type && type !== 'all') {
      list = list.filter((n) => n.message_type === type || n.type === type);
    }

    if (status && status !== 'all') {
      list = list.filter((n) => n.delivery_status === status);
    }

    return deepClone(list);
  }

  async retryNotification(id) {
    await delay(300);
    const list = getStored('notifications', mockStaffNotifications);
    const n = list.find((item) => item.id === id);
    if (!n) throw new Error('Notification not found');

    n.delivery_status = 'delivered';
    n.attempts += 1;
    n.error_message = null;
    setStored('notifications', list);

    return {
      success: true,
      notification: n,
      message: `Simulated redelivery successful. Outbox status set to Delivered.`,
      is_simulated: true,
    };
  }
}

export const staffMockAdapter = new StaffMockAdapter();
export default staffMockAdapter;
