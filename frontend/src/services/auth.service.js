import api, { TOKEN_STORAGE_KEY } from './api';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_AUTH === 'true';

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
        company_name: 'Mercer Media',
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

const mockAdapter = {
  login: async ({ email, password }) => {
    await new Promise((r) => setTimeout(r, 600));
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
    sessionStorage.setItem('brightloop_mock_session', JSON.stringify({ token, user }));
    return {
      access_token: token,
      token_type: 'bearer',
    };
  },

  getCurrentUser: async () => {
    await new Promise((r) => setTimeout(r, 300));
    const sessionStr = sessionStorage.getItem('brightloop_mock_session');
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
    await new Promise((r) => setTimeout(r, 600));
    const users = mockStorage.getUsers();
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      const error = new Error('An account with this email already exists.');
      error.userMessage = 'An account with this email already exists.';
      error.response = { status: 409, data: { detail: 'Email already registered.' } };
      throw error;
    }
    const newUser = {
      id: `usr-cust-${Date.now()}`,
      email,
      password,
      name,
      role: 'customer',
      company_name: company_name || null,
    };
    mockStorage.saveUser(newUser);
    return {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      message: 'Account created successfully.',
    };
  },

  forgotPassword: async ({ email }) => {
    await new Promise((r) => setTimeout(r, 500));
    // Always returns generic confirmation message, email is accepted
    if (!email) {
      const error = new Error('Email is required.');
      error.userMessage = 'Email address is required.';
      throw error;
    }
    return {
      message: 'If an account exists for this email, password reset instructions have been sent.',
    };
  },

  resetPassword: async ({ token, new_password }) => {
    await new Promise((r) => setTimeout(r, 600));
    if (!token || token.trim() === '' || token === 'invalid' || token === 'expired') {
      const error = new Error('Invalid or expired reset token.');
      error.userMessage = 'This password reset link is invalid or has expired. Please request a new one.';
      error.response = { status: 400, data: { detail: 'Invalid or expired token.' } };
      throw error;
    }
    if (!new_password) {
      const error = new Error('New password is required.');
      error.userMessage = 'New password is required.';
      throw error;
    }
    return {
      message: 'Password has been successfully reset. You may now sign in.',
    };
  },
};

export const authService = {
  /**
   * Submit credentials to authenticate
   * POST /auth/login
   */
  login: async ({ email, password }) => {
    if (USE_MOCK) {
      return mockAdapter.login({ email, password });
    }
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  /**
   * Retrieve authenticated user profile and verified role
   * GET /auth/me
   */
  getCurrentUser: async () => {
    if (USE_MOCK) {
      return mockAdapter.getCurrentUser();
    }
    const response = await api.get('/auth/me');
    return response.data;
  },

  /**
   * Register a new customer
   * POST /auth/signup
   */
  signup: async ({ name, email, password, company_name }) => {
    if (USE_MOCK) {
      return mockAdapter.signup({ name, email, password, company_name });
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
    if (USE_MOCK) {
      return mockAdapter.forgotPassword({ email });
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
    if (USE_MOCK) {
      return mockAdapter.resetPassword({ token, new_password });
    }
    // Include both new_password and password for compatibility with OpenAPI schema variants
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
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      sessionStorage.removeItem('brightloop_mock_session');
    } catch {
      // ignore
    }
  },
};

export default authService;
