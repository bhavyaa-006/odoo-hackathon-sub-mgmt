import api, { TOKEN_STORAGE_KEY } from './api.js';
import { isMockApiEnabled } from '../mocks/mockAdapter.js';

// Isolated Mock Adapter for offline development & frontend testing when backend is not running
const mockStorage = {
  getUsers: () => {
    try {
      const stored = localStorage.getItem('brightloop_mock_users');
      if (stored) return JSON.parse(stored);
    } catch {
      // fallback
    }
    // Default mock accounts
    return [
      {
        id: 'usr-customer-1',
        email: 'customer@brightloop.io',
        password: 'Password123!',
        name: 'Alex Mercer',
        role: 'customer',
        company_name: 'Mercer Media Private Limited',
      },
      {
        id: 'usr-staff-1',
        email: 'staff@brightloop.io',
        password: 'Password123!',
        name: 'Sarah Chen',
        role: 'staff',
        company_name: 'Brightloop Internal',
      },
      {
        id: 'usr-admin-1',
        email: 'admin@brightloop.io',
        password: 'Password123!',
        name: 'David Vance',
        role: 'admin',
        company_name: 'Brightloop Admin',
      },
    ];
  },
  saveUser: (user) => {
    const users = mockStorage.getUsers();
    users.push(user);
    try {
      localStorage.setItem('brightloop_mock_users', JSON.stringify(users));
    } catch {
      // fallback
    }
  },
};

const mockAuthAdapter = {
  login: async ({ email, password }) => {
    await new Promise((r) => setTimeout(r, 400));
    const users = mockStorage.getUsers();
    const user = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (!user) {
      const error = new Error('Invalid email or password.');
      error.userMessage = 'Invalid email or password.';
      error.response = { status: 401, data: { detail: 'Invalid credentials.' } };
      throw error;
    }
    const token = `mock-jwt-token-for-${user.id}-${Date.now()}`;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('brightloop_mock_session', JSON.stringify({ token, user }));
      sessionStorage.removeItem('brightloop_explicit_logout');
    }
    return {
      access_token: token,
      token_type: 'bearer',
    };
  },

  getCurrentUser: async () => {
    await new Promise((r) => setTimeout(r, 150));
    let sessionStr = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('brightloop_mock_session') : null;
    if (!sessionStr && isMockApiEnabled()) {
      const seeded = authService.seedMockCustomer();
      if (seeded) {
        sessionStr = JSON.stringify(seeded);
      }
    }
    if (!sessionStr) {
      const error = new Error('Unauthorized');
      error.response = { status: 401 };
      throw error;
    }
    const { user } = JSON.parse(sessionStr);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      company_name: user.company_name,
    };
  },

  signup: async ({ name, email, password, company_name }) => {
    await new Promise((r) => setTimeout(r, 450));
    const users = mockStorage.getUsers();
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      const error = new Error('An account with this email already exists.');
      error.userMessage = 'An account with this email already exists.';
      error.response = { status: 409, data: { detail: error.userMessage } };
      throw error;
    }
    const newUser = {
      id: `usr-customer-${Date.now()}`,
      email: email.trim().toLowerCase(),
      password,
      name: name.trim(),
      role: 'customer',
      company_name: company_name ? company_name.trim() : null,
    };
    mockStorage.saveUser(newUser);
    const token = `mock-jwt-token-for-${newUser.id}-${Date.now()}`;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('brightloop_mock_session', JSON.stringify({ token, user: newUser }));
      sessionStorage.removeItem('brightloop_explicit_logout');
    }
    return {
      access_token: token,
      token_type: 'bearer',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        company_name: newUser.company_name,
      },
    };
  },

  forgotPassword: async () => {
    await new Promise((r) => setTimeout(r, 300));
    return {
      message: 'If an account exists with this email, you will receive password reset instructions.',
    };
  },

  resetPassword: async ({ token, new_password }) => {
    await new Promise((r) => setTimeout(r, 350));
    if (!token || token.length < 10) {
      const error = new Error('This password reset link is invalid or has expired.');
      error.userMessage = 'This password reset link is invalid or has expired.';
      error.response = { status: 400, data: { detail: error.userMessage } };
      throw error;
    }
    const users = mockStorage.getUsers();
    if (users.length > 0) {
      users[0].password = new_password;
      try {
        localStorage.setItem('brightloop_mock_users', JSON.stringify(users));
      } catch {
        // ignore
      }
    }
    return {
      message: 'Your password has been successfully reset. You may now sign in with your new password.',
    };
  },
};

export const authService = {
  /**
   * Seed a mock customer session for immediate preview when mock mode is enabled
   */
  seedMockCustomer: () => {
    try {
      const token = 'mock-jwt-token-customer-alex-mercer';
      const user = {
        id: 'usr-customer-1',
        email: 'customer@brightloop.io',
        name: 'Alex Mercer',
        role: 'customer',
        company_name: 'Mercer Media Private Limited',
      };
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      }
      if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('brightloop_mock_session', JSON.stringify({ token, user }));
      }
      return { token, user };
    } catch {
      return null;
    }
  },

  /**
   * Authenticate user credentials
   * POST /auth/login
   */
  login: async ({ email, password }) => {
    if (isMockApiEnabled()) {
      return mockAuthAdapter.login({ email, password });
    }
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
    if (isMockApiEnabled()) {
      return mockAuthAdapter.getCurrentUser();
    }
    const response = await api.get('/auth/me');
    return response.data;
  },

  /**
   * Register a new customer
   * POST /auth/signup
   */
  signup: async ({ name, email, password, company_name }) => {
    if (isMockApiEnabled()) {
      return mockAuthAdapter.signup({ name, email, password, company_name });
    }
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
    if (isMockApiEnabled()) {
      return mockAuthAdapter.forgotPassword({ email });
    }
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
    if (isMockApiEnabled()) {
      return mockAuthAdapter.resetPassword({ token, new_password });
    }
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
      let token = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (
        !token &&
        isMockApiEnabled() &&
        typeof sessionStorage !== 'undefined' &&
        !sessionStorage.getItem('brightloop_explicit_logout')
      ) {
        const seeded = authService.seedMockCustomer();
        token = seeded?.token || null;
      }
      return token;
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
      if (typeof window !== 'undefined') {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem('brightloop_mock_session');
          sessionStorage.setItem('brightloop_explicit_logout', 'true');
        }
      }
    } catch {
      // ignore
    }
  },
};

export default authService;
