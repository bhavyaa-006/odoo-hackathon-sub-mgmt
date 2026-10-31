import { useState, useEffect } from 'react';
import { AuthContext } from './AuthContext';
import authService from '../services/auth.service';
import { PORTAL_CONFIG } from '../routes/routeConfig';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => authService.getToken());
  const [isLoading, setIsLoading] = useState(true);

  // Initialize Auth State on Application Mount
  useEffect(() => {
    let isMounted = true;

    const verifySession = async () => {
      const storedToken = authService.getToken();
      if (!storedToken) {
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        const currentUser = await authService.getCurrentUser();
        if (isMounted) {
          setUser(currentUser);
          setToken(storedToken);
        }
      } catch (error) {
        console.warn('Session verification failed, clearing auth state.', error.message);
        authService.clearToken();
        if (isMounted) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    verifySession();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Login with portal role verification
   * @param {string} portalId - 'customer' | 'staff' | 'admin'
   * @param {object} credentials - { email, password }
   */
  const login = async (portalId, credentials) => {
    // 1. Submit credentials to get JWT
    const data = await authService.login(credentials);
    const receivedToken = data.access_token || data.token;

    if (!receivedToken) {
      throw new Error('Authentication succeeded but no access token was returned.');
    }

    // 2. Temporarily set token to allow Authorization header on /auth/me
    authService.setToken(receivedToken);

    try {
      // 3. Fetch verified user profile from GET /auth/me
      const profile = await authService.getCurrentUser();

      // 4. Role enforcement against portal
      const portal = PORTAL_CONFIG[portalId];
      const userRole = (profile.role || '').toLowerCase();
      const isRoleAllowed = portal?.allowedRoles?.some(
        (allowed) => allowed.toLowerCase() === userRole
      );

      if (!isRoleAllowed) {
        // Clear authentication immediately
        authService.clearToken();
        setUser(null);
        setToken(null);
        // Generic error without disclosing actual role or suggesting redirection
        const mismatchError = new Error('Unable to sign in to this portal with the provided credentials.');
        mismatchError.userMessage = 'Unable to sign in to this portal with the provided credentials.';
        throw mismatchError;
      }

      // 5. Success: Commit authenticated user and token
      setUser(profile);
      setToken(receivedToken);
      return profile;
    } catch (err) {
      // On any verification failure or mismatch, ensure token is cleared
      authService.clearToken();
      setUser(null);
      setToken(null);
      throw err;
    }
  };

  /**
   * Register a new customer
   */
  const register = async (customerData) => {
    return await authService.signup(customerData);
  };

  /**
   * Clear session
   */
  const logout = () => {
    authService.clearToken();
    setUser(null);
    setToken(null);
  };

  /**
   * Refresh current user profile
   */
  const refreshUser = async () => {
    try {
      const refreshed = await authService.getCurrentUser();
      setUser(refreshed);
      return refreshed;
    } catch (error) {
      logout();
      throw error;
    }
  };

  const value = {
    user,
    token,
    isAuthenticated: Boolean(user && token),
    isLoading,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
