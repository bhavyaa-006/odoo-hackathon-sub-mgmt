import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ROUTES } from './routeConfig';

// Route Guards
import ProtectedRoute from '../components/auth/ProtectedRoute';
import PublicRoute from '../components/auth/PublicRoute';

// Pages
import LandingPage from '../pages/LandingPage';
import CustomerLogin from '../pages/CustomerLogin';
import StaffLogin from '../pages/StaffLogin';
import AdminLogin from '../pages/AdminLogin';
import CustomerRegister from '../pages/CustomerRegister';
import ForgotPassword from '../pages/ForgotPassword';
import ResetPassword from '../pages/ResetPassword';
import NotFoundPage from '../pages/NotFoundPage';

// Portal Placeholders
import CustomerPortalPlaceholder from '../pages/placeholders/CustomerPortalPlaceholder';
import StaffPortalPlaceholder from '../pages/placeholders/StaffPortalPlaceholder';
import AdminPortalPlaceholder from '../pages/placeholders/AdminPortalPlaceholder';

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Landing Page */}
        <Route path={ROUTES.HOME} element={<LandingPage />} />

        {/* Portal Authentication Routes (Redirects authenticated users to their own dashboard) */}
        <Route
          path={ROUTES.CUSTOMER_LOGIN}
          element={
            <PublicRoute>
              <CustomerLogin />
            </PublicRoute>
          }
        />
        <Route
          path={ROUTES.STAFF_LOGIN}
          element={
            <PublicRoute>
              <StaffLogin />
            </PublicRoute>
          }
        />
        <Route
          path={ROUTES.ADMIN_LOGIN}
          element={
            <PublicRoute>
              <AdminLogin />
            </PublicRoute>
          }
        />
        <Route
          path={ROUTES.CUSTOMER_REGISTER}
          element={
            <PublicRoute>
              <CustomerRegister />
            </PublicRoute>
          }
        />

        {/* Shared Password Management Routes */}
        <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPassword />} />
        <Route path={ROUTES.RESET_PASSWORD} element={<ResetPassword />} />

        {/* Protected Customer Destination */}
        <Route
          path={ROUTES.CUSTOMER_DASHBOARD}
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <CustomerPortalPlaceholder />
            </ProtectedRoute>
          }
        />

        {/* Protected Staff Destination */}
        <Route
          path={ROUTES.STAFF_DASHBOARD}
          element={
            <ProtectedRoute allowedRoles={['staff', 'finance']}>
              <StaffPortalPlaceholder />
            </ProtectedRoute>
          }
        />

        {/* Protected Admin Destination */}
        <Route
          path={ROUTES.ADMIN_DASHBOARD}
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminPortalPlaceholder />
            </ProtectedRoute>
          }
        />

        {/* 404 Catch-All */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
