import api from './api.js';

export const taxService = {
  /**
   * GET /taxes
   */
  getTaxRules: async () => {
    const response = await api.get('/taxes');
    return response.data;
  },

  /**
   * GET /taxes/default
   */
  getDefaultTaxRule: async () => {
    const response = await api.get('/taxes/default');
    return response.data;
  },

  /**
   * GET /taxes/state-codes
   */
  getStateCodes: async () => {
    const response = await api.get('/taxes/state-codes');
    return response.data;
  },

  /**
   * GET /taxes/validate-gstin
   */
  validateGSTIN: async (gstin) => {
    const response = await api.get('/taxes/validate-gstin', { params: { gstin } });
    return response.data;
  },

  /**
   * POST /taxes/calculate
   */
  calculateTax: async (payload) => {
    const response = await api.post('/taxes/calculate', payload);
    return response.data;
  },
};

export default taxService;
