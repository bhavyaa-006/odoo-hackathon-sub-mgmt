import api from './api.js';

export const staffService = {
  /**
   * GET /staff/dashboard
   */
  getDashboard: async () => {
    const response = await api.get('/staff/dashboard');
    return response.data;
  },

  /**
   * Operations Clock
   */
  getTimeMachineDate: () => {
    return new Date().toISOString().split('T')[0];
  },

  advanceTimeMachine: async (days) => {
    const response = await api.post('/staff/time-machine/advance', { days });
    return response.data;
  },

  /**
   * Cross-entity Search & AI Query
   */
  searchAll: async (query) => {
    const response = await api.get('/staff/search', { params: { q: query } });
    return response.data;
  },

  askAI: async (question) => {
    const response = await api.post('/ai/ask', { question });
    return response.data;
  },

  /**
   * Health Check
   */
  healthCheck: async () => {
    const response = await api.get('/health');
    return response.data;
  },
};

export default staffService;
