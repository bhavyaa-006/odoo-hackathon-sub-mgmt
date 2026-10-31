import api from './api.js';

export const notificationService = {
  /**
   * Customer Notifications
   */
  getOutboxNotifications: async (params = {}) => {
    const response = await api.get('/portal/notifications', { params });
    const data = response.data;
    if (Array.isArray(data)) {
      const unreadCount = data.filter((m) => !m.is_read).length;
      return { messages: data, unread_count: unreadCount };
    }
    return data;
  },

  markAsRead: async () => {
    const response = await api.post('/portal/notifications/read-all');
    return response.data;
  },

  /**
   * Staff Notifications
   */
  getStaffNotifications: async (params = {}) => {
    const response = await api.get('/staff/notifications', { params });
    return response.data;
  },

  retryNotification: async (id) => {
    const response = await api.post(`/staff/notifications/${id}/retry`);
    return response.data;
  },
};

export default notificationService;
