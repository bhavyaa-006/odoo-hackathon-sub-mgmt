import api from './api.js';

export const invoiceService = {
  /**
   * Customer Portal Invoices
   */
  getInvoices: async (params = {}) => {
    const response = await api.get('/portal/invoices', { params });
    return response.data;
  },

  getInvoice: async (id) => {
    const response = await api.get(`/portal/invoices/${id}`);
    return response.data;
  },

  payInvoice: async (id, paymentData) => {
    const response = await api.post(`/portal/invoices/${id}/pay`, paymentData);
    return response.data;
  },

  getInvoicePrintData: async (id) => {
    const response = await api.get(`/portal/invoices/${id}/print`);
    return response.data;
  },

  /**
   * Staff & Admin Invoices (FastAPI Billing Service endpoints)
   */
  getStaffInvoices: async (params = {}) => {
    const response = await api.get('/invoices', { params });
    return response.data;
  },

  getStaffInvoice: async (id) => {
    const response = await api.get(`/invoices/${id}`);
    return response.data;
  },

  confirmInvoice: async (id) => {
    const response = await api.post(`/invoices/${id}/confirm`);
    return response.data;
  },

  cancelInvoiceWithCreditNote: async (id, data = {}) => {
    const response = await api.post(`/invoices/${id}/void`, data);
    return response.data;
  },

  getOverdueSummary: async () => {
    const response = await api.get('/staff/overdue');
    return response.data;
  },
};

export default invoiceService;
