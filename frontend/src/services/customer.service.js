import api from './api.js';

export const customerService = {
  /**
   * GET /portal/overview
   */
  getOverview: async () => {
    const response = await api.get('/portal/overview');
    return response.data;
  },

  /**
   * GET /portal/profile
   */
  getProfile: async () => {
    const response = await api.get('/portal/profile');
    return response.data;
  },

  /**
   * PATCH /portal/profile
   */
  updateProfile: async (profileData) => {
    const response = await api.patch('/portal/profile', profileData);
    return response.data;
  },

  /**
   * GET /staff/customers
   */
  getStaffCustomers: async (params = {}) => {
    const response = await api.get('/staff/customers', { params });
    return response.data;
  },

  /**
   * GET /staff/customers/{id}
   */
  getStaffCustomer: async (id) => {
    const response = await api.get(`/staff/customers/${id}`);
    return response.data;
  },

  /**
   * POST /staff/customers/{id}/assign
   */
  assignStaff: async (customerId, staffId) => {
    const response = await api.post(`/staff/customers/${customerId}/assign`, { staff_id: staffId });
    return response.data;
  },
};

export default customerService;
