import api from './api.js';

export const quotationService = {
  /**
   * Customer Quotations
   */
  getQuotations: async (params = {}) => {
    const response = await api.get('/portal/quotations', { params });
    return response.data;
  },

  getQuotation: async (id) => {
    const response = await api.get(`/portal/quotations/${id}`);
    return response.data;
  },

  acceptQuotation: async (id) => {
    const response = await api.post(`/portal/quotations/${id}/accept`);
    return response.data;
  },

  /**
   * Staff Quotations
   */
  getStaffQuotations: async (params = {}) => {
    const response = await api.get('/staff/quotations', { params });
    return response.data;
  },

  getStaffQuotation: async (id) => {
    const response = await api.get(`/staff/quotations/${id}`);
    return response.data;
  },

  getQuotationTemplates: async () => {
    const response = await api.get('/staff/quotation-templates');
    return response.data;
  },

  createQuotation: async (data) => {
    const response = await api.post('/staff/quotations', data);
    return response.data;
  },

  sendQuotation: async (id) => {
    const response = await api.post(`/staff/quotations/${id}/send`);
    return response.data;
  },

  confirmQuotation: async (id) => {
    const response = await api.post(`/staff/quotations/${id}/confirm`);
    return response.data;
  },
};

export default quotationService;
