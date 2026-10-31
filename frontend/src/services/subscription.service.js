import api from './api.js';
import mockAdapter, { isMockApiEnabled } from '../mocks/mockAdapter.js';
import { AVAILABLE_PLANS } from '../mocks/fixtures/subscriptions.fixtures.js';

export { AVAILABLE_PLANS };

export const subscriptionService = {
  /**
   * GET /portal/subscriptions
   */
  getSubscriptions: async (params = {}) => {
    if (isMockApiEnabled()) {
      return mockAdapter.getSubscriptions(params);
    }
    const response = await api.get('/portal/subscriptions', { params });
    return response.data;
  },

  /**
   * GET /portal/subscriptions/{id}
   */
  getSubscription: async (id) => {
    if (isMockApiEnabled()) {
      return mockAdapter.getSubscription(id);
    }
    const response = await api.get(`/portal/subscriptions/${id}`);
    return response.data;
  },

  /**
   * POST /portal/subscriptions/{id}/action
   */
  performAction: async (id, action) => {
    if (isMockApiEnabled()) {
      return mockAdapter.performSubscriptionAction(id, action);
    }
    const response = await api.post(`/portal/subscriptions/${id}/action`, { action });
    return response.data;
  },

  /**
   * POST /portal/subscriptions/{id}/change/preview
   */
  previewPlanChange: async (id, payload) => {
    if (isMockApiEnabled()) {
      return mockAdapter.previewPlanChange(id, payload);
    }
    const response = await api.post(`/portal/subscriptions/${id}/change/preview`, payload);
    return response.data;
  },

  /**
   * POST /portal/subscriptions/{id}/change/apply
   */
  applyPlanChange: async (id, payload) => {
    if (isMockApiEnabled()) {
      return mockAdapter.applyPlanChange(id, payload);
    }
    const response = await api.post(`/portal/subscriptions/${id}/change/apply`, payload);
    return response.data;
  },
};

export default subscriptionService;
