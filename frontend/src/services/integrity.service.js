import api from './api.js';

export const integrityService = {
  /**
   * GET /staff/integrity
   */
  getIntegrityChecks: async () => {
    const response = await api.get('/staff/integrity');
    return response.data;
  },

  /**
   * POST /staff/integrity/run
   */
  runIntegrityChecks: async () => {
    const response = await api.post('/staff/integrity/run');
    return response.data;
  },
};

export default integrityService;
