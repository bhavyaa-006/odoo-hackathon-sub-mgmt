import api from './api.js';
import mockAdapter, { isMockApiEnabled } from '../mocks/mockAdapter.js';

export const notificationService = {
  /**
   * GET /outbox
   */
  getOutboxNotifications: async (params = {}) => {
    if (isMockApiEnabled()) {
      return mockAdapter.getNotifications(params);
    }
    const response = await api.get('/outbox', { params });
    const data = response.data;
    if (Array.isArray(data)) {
      const unreadCount = data.filter((m) => !m.is_read).length;
      return { messages: data, unread_count: unreadCount };
    }
    return data;
  },

  /**
   * PATCH /outbox/{id}/read
   */
  markAsRead: async (id) => {
    if (isMockApiEnabled()) {
      return mockAdapter.markNotificationRead(id);
    }
    const response = await api.patch(`/outbox/${id}/read`);
    return response.data;
  },
};

export default notificationService;
