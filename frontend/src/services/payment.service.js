import api from './api.js';

export const paymentService = {
  /**
   * GET /payments
   */
  getPayments: async (params = {}) => {
    const response = await api.get('/payments', { params });
    return response.data;
  },

  /**
   * GET /payments/{id}
   */
  getPayment: async (id) => {
    const response = await api.get(`/payments/${id}`);
    return response.data;
  },

  /**
   * POST /payments
   */
  recordPayment: async (data) => {
    const response = await api.post('/payments', data);
    return response.data;
  },

  /**
   * POST /payments/{id}/confirm
   */
  confirmPayment: async (id, data = {}) => {
    const response = await api.post(`/payments/${id}/confirm`, data);
    return response.data;
  },

  /**
   * POST /payments/{id}/reverse (admin only)
   */
  reversePayment: async (id, data = {}) => {
    const response = await api.post(`/payments/${id}/reverse`, data);
    return response.data;
  },

  /**
   * POST /payments/{id}/allocate
   */
  allocatePayment: async (id, data) => {
    const response = await api.post(`/payments/${id}/allocate`, data);
    return response.data;
  },
};

export default paymentService;
