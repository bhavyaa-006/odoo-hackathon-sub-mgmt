import api from './api.js';

export const discountService = {
  /**
   * GET /discounts
   */
  getDiscounts: async (params = {}) => {
    const response = await api.get('/discounts', { params });
    return response.data;
  },

  /**
   * GET /discounts/eligibility
   */
  checkEligibility: async (params = {}) => {
    const response = await api.get('/discounts/eligibility', { params });
    return response.data;
  },

  /**
   * POST /discounts/apply
   */
  applyDiscount: async (payload) => {
    const response = await api.post('/discounts/apply', payload);
    return response.data;
  },

  /**
   * GET /discounts/subscriptions/{id}
   */
  getSubscriptionDiscounts: async (subscriptionId) => {
    const response = await api.get(`/discounts/subscriptions/${subscriptionId}`);
    return response.data;
  },
};

export default discountService;
