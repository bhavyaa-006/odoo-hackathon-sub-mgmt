import api from './api.js';

export const productService = {
  /**
   * GET /api/v1/products
   */
  getProducts: async (params = {}) => {
    const response = await api.get('/api/v1/products', { params });
    return response.data;
  },

  /**
   * GET /api/v1/products/{id}
   */
  getProduct: async (id) => {
    const response = await api.get(`/api/v1/products/${id}`);
    return response.data;
  },

  /**
   * GET /api/v1/products/{id}/variants
   */
  getVariants: async (id) => {
    const response = await api.get(`/api/v1/products/${id}/variants`);
    return response.data;
  },

  /**
   * POST /api/v1/products/{id}/calculate-price
   */
  calculatePrice: async (id, variantIds = []) => {
    const response = await api.post(`/api/v1/products/${id}/calculate-price`, { variant_ids: variantIds });
    return response.data;
  },
};

export default productService;
