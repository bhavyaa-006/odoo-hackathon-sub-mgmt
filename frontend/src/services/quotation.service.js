import api from './api.js';
import mockAdapter, { isMockApiEnabled } from '../mocks/mockAdapter.js';

export const quotationService = {
  /**
   * GET /portal/quotations
   */
  getQuotations: async (params = {}) => {
    if (isMockApiEnabled()) {
      return mockAdapter.getQuotations(params);
    }
    const response = await api.get('/portal/quotations', { params });
    return response.data;
  },

  /**
   * GET /portal/quotations/{id}
   */
  getQuotation: async (id) => {
    if (isMockApiEnabled()) {
      return mockAdapter.getQuotation(id);
    }
    const response = await api.get(`/portal/quotations/${id}`);
    return response.data;
  },

  /**
   * POST /portal/quotations/{id}/accept
   */
  acceptQuotation: async (id) => {
    if (isMockApiEnabled()) {
      return mockAdapter.acceptQuotation(id);
    }
    const response = await api.post(`/portal/quotations/${id}/accept`);
    return response.data;
  },
};

export default quotationService;
