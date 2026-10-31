import api from './api.js';

export const financeService = {
  /**
   * GET /staff/finance/metrics
   */
  getFinanceMetrics: async () => {
    const response = await api.get('/staff/finance/metrics');
    return response.data;
  },
};

export default financeService;
