import api from './api.js';

export const creditNoteService = {
  /**
   * GET /staff/credit-notes
   */
  getCreditNotes: async () => {
    const response = await api.get('/staff/credit-notes');
    return response.data;
  },

  /**
   * GET /staff/credit-notes/{id}
   */
  getCreditNote: async (id) => {
    const response = await api.get(`/staff/credit-notes/${id}`);
    return response.data;
  },

  /**
   * POST /staff/credit-notes
   */
  createCreditNote: async (data) => {
    const response = await api.post('/staff/credit-notes', data);
    return response.data;
  },

  /**
   * POST /staff/credit-notes/{id}/apply
   */
  applyCredit: async (id, { invoice_id, amount_minor }) => {
    const response = await api.post(`/staff/credit-notes/${id}/apply`, { invoice_id, amount_minor });
    return response.data;
  },
};

export default creditNoteService;
