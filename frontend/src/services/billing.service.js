import api from './api.js';

export const billingService = {
  /**
   * GET /billing/runs
   */
  getBillingRuns: async (params = {}) => {
    const response = await api.get('/billing/runs', { params });
    return response.data;
  },

  /**
   * GET /billing/runs/{id}
   */
  getBillingRun: async (id) => {
    const response = await api.get(`/billing/runs/${id}`);
    return response.data;
  },

  /**
   * POST /billing/runs (preview / dry run)
   */
  previewBillingRun: async (data = {}) => {
    const payload = {
      as_of_date: data.as_of_date || new Date().toISOString().split('T')[0],
      dry_run: true,
      subscription_ids: data.subscription_ids || null,
    };
    const response = await api.post('/billing/runs', payload);
    return response.data;
  },

  dryRunBillingRun: async (data = {}) => {
    const payload = {
      as_of_date: data.as_of_date || new Date().toISOString().split('T')[0],
      dry_run: true,
      subscription_ids: data.subscription_ids || null,
    };
    const response = await api.post('/billing/runs', payload);
    return response.data;
  },

  /**
   * POST /billing/runs (live commit - admin only)
   */
  commitBillingRun: async (data = {}) => {
    const payload = {
      as_of_date: data.as_of_date || new Date().toISOString().split('T')[0],
      dry_run: false,
      subscription_ids: data.subscription_ids || null,
    };
    const response = await api.post('/billing/runs', payload);
    return response.data;
  },

  /**
   * POST /billing/runs/{runId}/retry-item
   */
  retryBillingRunItem: async (runId, itemId) => {
    const response = await api.post(`/billing/runs/${runId}/retry-item`, { item_id: itemId });
    return response.data;
  },
};

export default billingService;
