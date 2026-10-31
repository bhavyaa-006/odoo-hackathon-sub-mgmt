import api, { TOKEN_STORAGE_KEY } from './api.js';

export const authService = {
  /**
   * Authenticate user credentials against real backend
   * POST /auth/login
   */
  login: async ({ email, password }) => {
    const response = await api.post('/auth/login', {
      email: email.trim().toLowerCase(),
      password,
    });
    return response.data;
  },

  /**
   * Fetch authenticated user identity
   * GET /auth/me
   */
  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  /**
   * Register a new customer
   * POST /auth/signup
   */
  signup: async ({ name, email, password, company_name }) => {
    const payload = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      ...(company_name && { company_name: company_name.trim() }),
    };
    const response = await api.post('/auth/signup', payload);
    return response.data;
  },

  /**
   * Request password reset instructions
   * POST /auth/forgot
   */
  forgotPassword: async ({ email }) => {
    const response = await api.post('/auth/forgot', {
      email: email.trim().toLowerCase(),
    });
    return response.data;
  },

  /**
   * Complete password reset with URL token
   * POST /auth/reset
   */
  resetPassword: async ({ token, new_password }) => {
    const payload = {
      token,
      new_password,
      password: new_password,
    };
    const response = await api.post('/auth/reset', payload);
    return response.data;
  },

  /**
   * Token storage utilities
   */
  getToken: () => {
    try {
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  },

  setToken: (token) => {
    try {
      if (token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Failed to save token to localStorage', e);
    }
  },

  clearToken: () => {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  },
};

export default authService;
