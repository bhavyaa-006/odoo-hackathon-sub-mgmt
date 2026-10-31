import axios from 'axios';

const API_BASE_URL = import.meta?.env?.VITE_API_BASE_URL || 'http://localhost:8000';

export const TOKEN_STORAGE_KEY = 'brightloop_auth_token';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Bearer Token if present
api.interceptors.request.use(
  (config) => {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
        const token = localStorage.getItem(TOKEN_STORAGE_KEY);
        if (token && !config.headers.Authorization) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch {
      // LocalStorage access issues (e.g. sandboxed iframe or private browsing)
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Format errors and handle session expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Standardize error message extraction
    let formattedMessage = 'An unexpected error occurred. Please try again.';

    if (error.response) {
      const { status, data } = error.response;

      // Extract details from FastAPI standard error response or custom dict
      if (typeof data?.detail === 'string') {
        formattedMessage = data.detail;
      } else if (Array.isArray(data?.detail)) {
        // FastAPI validation errors (422) array of { loc, msg, type }
        formattedMessage = data.detail.map((err) => err.msg || err.message).join('; ');
      } else if (data?.message) {
        formattedMessage = data.message;
      } else if (status === 401) {
        formattedMessage = 'Invalid credentials or session expired.';
      } else if (status === 403) {
        formattedMessage = 'You do not have permission to perform this action.';
      } else if (status === 404) {
        formattedMessage = 'The requested resource was not found.';
      } else if (status === 409) {
        formattedMessage = 'An account with this email already exists.';
      } else if (status >= 500) {
        formattedMessage = 'Server is currently unavailable. Please try again shortly.';
      }
    } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      formattedMessage = 'The request timed out. Please check your connection and retry.';
    } else if (error.request) {
      formattedMessage = 'Cannot connect to the server. Please check your network connection.';
    }

    // Attach friendly message to error object
    error.userMessage = formattedMessage;

    return Promise.reject(error);
  }
);

export default api;
