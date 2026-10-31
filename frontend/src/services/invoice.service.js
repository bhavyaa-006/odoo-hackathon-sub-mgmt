import api from './api.js';
import mockAdapter, { isMockApiEnabled } from '../mocks/mockAdapter.js';

export const invoiceService = {
  /**
   * GET /portal/invoices
   */
  getInvoices: async (params = {}) => {
    if (isMockApiEnabled()) {
      return mockAdapter.getInvoices(params);
    }
    const response = await api.get('/portal/invoices', { params });
    const data = response.data;
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  },

  /**
   * GET /portal/invoices/{id}
   */
  getInvoice: async (id) => {
    if (isMockApiEnabled()) {
      return mockAdapter.getInvoice(id);
    }
    const response = await api.get(`/portal/invoices/${id}`);
    return response.data;
  },

  /**
   * POST /portal/invoices/{id}/pay
   */
  payInvoice: async (id, paymentData) => {
    if (isMockApiEnabled()) {
      return mockAdapter.payInvoice(id, paymentData);
    }
    const response = await api.post(`/portal/invoices/${id}/pay`, paymentData);
    return response.data;
  },

  /**
   * GET /portal/invoices/{id}/print
   */
  getInvoicePrintData: async (id) => {
    if (isMockApiEnabled()) {
      return mockAdapter.getInvoice(id);
    }
    const response = await api.get(`/portal/invoices/${id}/print`);
    return response.data;
  },
};

export default invoiceService;
