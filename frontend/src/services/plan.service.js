import api from './api.js';

export const planService = {
  /**
   * GET /api/v1/plans
   */
  getPlans: async (params = {}) => {
    const response = await api.get('/api/v1/plans', { params });
    return response.data;
  },

  /**
   * GET /api/v1/plans/{id}
   */
  getPlan: async (id) => {
    const response = await api.get(`/api/v1/plans/${id}`);
    return response.data;
  },

  /**
   * GET /api/v1/plans/{id}/availability
   */
  checkAvailability: async (id, checkDate) => {
    const params = checkDate ? { check_date: checkDate } : {};
    const response = await api.get(`/api/v1/plans/${id}/availability`, { params });
    return response.data;
  },

  /**
   * POST /api/v1/plans/{id}/price
   */
  calculatePrice: async (id, quantity) => {
    const response = await api.post(`/api/v1/plans/${id}/price`, { quantity });
    return response.data;
  },
};

export default planService;
