import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROLE_DESTINATIONS, ROUTES } from '../../routes/routeConfig';
import LoadingSpinner from '../ui/LoadingSpinner';

export const PublicRoute = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F5] font-sans">
        <LoadingSpinner size="lg" color="#1F4E79" />
      </div>
    );
  }

  if (isAuthenticated && user) {
    const userRole = (user.role || '').toLowerCase();
    const destination = ROLE_DESTINATIONS[userRole] || ROUTES.CUSTOMER_DASHBOARD;
    return <Navigate to={destination} replace />;
  }

  return children;
};

export default PublicRoute;
