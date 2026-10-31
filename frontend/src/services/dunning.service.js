import api from './api.js';

export const dunningService = {
  /**
   * GET /staff/dunning
   */
  getDunningOverview: async () => {
    const response = await api.get('/staff/dunning');
    return response.data;
  },

  /**
   * GET /staff/dunning/{id}
   */
  getDunningCase: async (id) => {
    const response = await api.get(`/staff/dunning/${id}`);
    return response.data;
  },

  /**
   * POST /staff/dunning/{id}/retry
   */
  retryAttempt: async (id) => {
    const response = await api.post(`/staff/dunning/${id}/retry`);
    return response.data;
  },

  /**
   * POST /staff/dunning/{id}/generate-reminder
   */
  generateAIReminder: async (id, tone) => {
    const response = await api.post(`/staff/dunning/${id}/generate-reminder`, { tone });
    return response.data;
  },
};

export default dunningService;
