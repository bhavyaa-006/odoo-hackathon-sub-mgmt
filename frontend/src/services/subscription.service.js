import api from './api.js';

export const AVAILABLE_PLANS = [];

export const subscriptionService = {
  /**
   * Customer Subscriptions
   */
  getSubscriptions: async (params = {}) => {
    const response = await api.get('/portal/subscriptions', { params });
    return response.data;
  },

  getSubscription: async (id) => {
    const response = await api.get(`/portal/subscriptions/${id}`);
    return response.data;
  },

  performAction: async (id, action) => {
    const response = await api.post(`/portal/subscriptions/${id}/action`, { action });
    return response.data;
  },

  previewPlanChange: async (id, payload) => {
    const response = await api.post(`/portal/subscriptions/${id}/change/preview`, payload);
    return response.data;
  },

  applyPlanChange: async (id, payload) => {
    const response = await api.post(`/portal/subscriptions/${id}/change/apply`, payload);
    return response.data;
  },

  /**
   * Staff Subscriptions
   */
  getStaffSubscriptions: async (params = {}) => {
    const response = await api.get('/staff/subscriptions', { params });
    return response.data;
  },

  getStaffSubscription: async (id) => {
    const response = await api.get(`/staff/subscriptions/${id}`);
    return response.data;
  },

  performStaffAction: async (id, action) => {
    const response = await api.post(`/staff/subscriptions/${id}/action`, { action });
    return response.data;
  },

  /**
   * Get real catalogue plans from backend Plan Service
   */
  getAvailablePlans: async (params = {}) => {
    const response = await api.get('/api/v1/plans', { params });
    return response.data?.items || response.data || [];
  },
};

export default subscriptionService;
