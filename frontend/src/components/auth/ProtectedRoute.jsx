import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES, ROLE_DESTINATIONS } from '../../routes/routeConfig';
import LoadingSpinner from '../ui/LoadingSpinner';

export const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F5] font-sans">
        <LoadingSpinner size="lg" color="#1F4E79" />
        <p className="text-xs font-semibold text-[#4B6584] mt-3 tracking-wide uppercase">
          Verifying session...
        </p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    // Determine the most appropriate login page based on attempted path
    const path = location.pathname.toLowerCase();
    let loginTarget = ROUTES.CUSTOMER_LOGIN;
    if (path.startsWith('/admin')) {
      loginTarget = ROUTES.ADMIN_LOGIN;
    } else if (path.startsWith('/staff')) {
      loginTarget = ROUTES.STAFF_LOGIN;
    }

    return <Navigate to={loginTarget} state={{ from: location }} replace />;
  }

  // Check role authorization if restricted
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = (user.role || '').toLowerCase();
    const isAllowed = allowedRoles.some((role) => role.toLowerCase() === userRole);

    if (!isAllowed) {
      // User is authenticated but attempting to access a portal they are not authorized for.
      // Redirect to their own authorized portal destination.
      const destination = ROLE_DESTINATIONS[userRole] || ROUTES.CUSTOMER_DASHBOARD;
      return <Navigate to={destination} replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
