import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ROUTES } from './routeConfig';

// Route Guards
import ProtectedRoute from '../components/auth/ProtectedRoute';
import PublicRoute from '../components/auth/PublicRoute';

// Public Pages
import LandingPage from '../pages/LandingPage';
import CustomerLogin from '../pages/CustomerLogin';
import StaffLogin from '../pages/StaffLogin';
import AdminLogin from '../pages/AdminLogin';
import CustomerRegister from '../pages/CustomerRegister';
import ForgotPassword from '../pages/ForgotPassword';
import ResetPassword from '../pages/ResetPassword';
import NotFoundPage from '../pages/NotFoundPage';

// Customer Portal Components & Pages
import CustomerLayout from '../components/customer/CustomerLayout';
import CustomerDashboard from '../pages/customer/Dashboard';
import SubscriptionsPage from '../pages/customer/subscriptions/SubscriptionsPage';
import SubscriptionDetailPage from '../pages/customer/subscriptions/SubscriptionDetailPage';
import QuotationsPage from '../pages/customer/quotations/QuotationsPage';
import QuotationDetailPage from '../pages/customer/quotations/QuotationDetailPage';
import InvoicesPage from '../pages/customer/invoices/InvoicesPage';
import InvoiceDetailPage from '../pages/customer/invoices/InvoiceDetailPage';
import NotificationsPage from '../pages/customer/notifications/NotificationsPage';
import ProfilePage from '../pages/customer/profile/ProfilePage';
import CustomerNotFound from '../pages/customer/CustomerNotFound';

// Other Portal Placeholders (Phase 3 & 4)
import StaffPortalPlaceholder from '../pages/placeholders/StaffPortalPlaceholder';
import AdminPortalPlaceholder from '../pages/placeholders/AdminPortalPlaceholder';

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Landing Page */}
        <Route path={ROUTES.HOME} element={<LandingPage />} />

        {/* Portal Authentication Routes */}
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

        {/* Customer Portal (Protected, role: 'customer') */}
        <Route
          path="/customer"
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <CustomerLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<CustomerDashboard />} />
          <Route path="subscriptions" element={<SubscriptionsPage />} />
          <Route path="subscriptions/:id" element={<SubscriptionDetailPage />} />
          <Route path="quotations" element={<QuotationsPage />} />
          <Route path="quotations/:id" element={<QuotationDetailPage />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="invoices/:id" element={<InvoiceDetailPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="404" element={<CustomerNotFound />} />
        </Route>

        {/* Protected Staff Destination Placeholder */}
        <Route
          path={ROUTES.STAFF_DASHBOARD}
          element={
            <ProtectedRoute allowedRoles={['staff', 'finance']}>
              <StaffPortalPlaceholder />
            </ProtectedRoute>
          }
        />

        {/* Protected Admin Destination Placeholder */}
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
