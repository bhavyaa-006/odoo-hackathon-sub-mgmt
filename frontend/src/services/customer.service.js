import api from './api.js';
import mockAdapter, { isMockApiEnabled } from '../mocks/mockAdapter.js';

export const customerService = {
  /**
   * GET /portal/overview
   */
  getOverview: async () => {
    if (isMockApiEnabled()) {
      return mockAdapter.getOverview();
    }
    const response = await api.get('/portal/overview');
    return response.data;
  },

  /**
   * GET /portal/profile
   */
  getProfile: async () => {
    if (isMockApiEnabled()) {
      return mockAdapter.getProfile();
    }
    const response = await api.get('/portal/profile');
    return response.data;
  },

  /**
   * PATCH /portal/profile
   */
  updateProfile: async (profileData) => {
    if (isMockApiEnabled()) {
      return mockAdapter.updateProfile(profileData);
    }
    const response = await api.patch('/portal/profile', profileData);
    return response.data;
  },
};

export default customerService;
