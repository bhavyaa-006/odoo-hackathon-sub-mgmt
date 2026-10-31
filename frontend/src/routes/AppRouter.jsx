import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ROUTES } from './routeConfig';

// Route Guards
import ProtectedRoute from '../components/auth/ProtectedRoute';
import PublicRoute from '../components/auth/PublicRoute';
import FinanceGuard from '../components/staff/FinanceGuard';

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

// Staff Workspace Components & Pages (Phase 3)
import StaffLayout from '../components/staff/StaffLayout';
import StaffDashboard from '../pages/staff/Dashboard';
import StaffCustomersPage from '../pages/staff/customers/CustomersPage';
import StaffCustomerDetailPage from '../pages/staff/customers/CustomerDetailPage';
import StaffQuotationsPage from '../pages/staff/quotations/QuotationsPage';
import StaffCreateQuotationPage from '../pages/staff/quotations/CreateQuotationPage';
import StaffQuotationDetailPage from '../pages/staff/quotations/QuotationDetailPage';
import StaffSubscriptionsPage from '../pages/staff/subscriptions/SubscriptionsPage';
import StaffSubscriptionDetailPage from '../pages/staff/subscriptions/SubscriptionDetailPage';
import StaffInvoicesPage from '../pages/staff/invoices/InvoicesPage';
import StaffInvoiceDetailPage from '../pages/staff/invoices/InvoiceDetailPage';
import StaffOverduePage from '../pages/staff/overdue/OverduePage';
import StaffPaymentsPage from '../pages/staff/payments/PaymentsPage';
import StaffRecordPaymentPage from '../pages/staff/payments/RecordPaymentPage';
import StaffPaymentDetailPage from '../pages/staff/payments/PaymentDetailPage';
import StaffDunningPage from '../pages/staff/dunning/DunningPage';
import StaffDunningDetailPage from '../pages/staff/dunning/DunningDetailPage';
import StaffCreditNotesPage from '../pages/staff/credit-notes/CreditNotesPage';
import StaffCreditNoteDetailPage from '../pages/staff/credit-notes/CreditNoteDetailPage';
import StaffBillingRunsPage from '../pages/staff/billing-runs/BillingRunsPage';
import StaffBillingRunDetailPage from '../pages/staff/billing-runs/BillingRunDetailPage';
import StaffFinanceDashboard from '../pages/staff/finance/FinanceDashboard';
import StaffIntegrityPage from '../pages/staff/integrity/IntegrityPage';
import StaffNotificationsPage from '../pages/staff/notifications/NotificationsPage';
import StaffNotFound from '../pages/staff/StaffNotFound';

// Phase 4 Admin Placeholder
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

        {/* Staff Workspace (Protected, roles: ['staff', 'finance', 'admin']) */}
        <Route
          path="/staff"
          element={
            <ProtectedRoute allowedRoles={['staff', 'finance', 'admin']}>
              <StaffLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<StaffDashboard />} />
          <Route path="customers" element={<StaffCustomersPage />} />
          <Route path="customers/:id" element={<StaffCustomerDetailPage />} />
          <Route path="quotations" element={<StaffQuotationsPage />} />
          <Route path="quotations/new" element={<StaffCreateQuotationPage />} />
          <Route path="quotations/:id" element={<StaffQuotationDetailPage />} />
          <Route path="subscriptions" element={<StaffSubscriptionsPage />} />
          <Route path="subscriptions/:id" element={<StaffSubscriptionDetailPage />} />
          <Route path="invoices" element={<StaffInvoicesPage />} />
          <Route path="invoices/:id" element={<StaffInvoiceDetailPage />} />
          <Route path="overdue" element={<StaffOverduePage />} />
          <Route path="payments" element={<StaffPaymentsPage />} />
          <Route path="payments/new" element={<StaffRecordPaymentPage />} />
          <Route path="payments/:id" element={<StaffPaymentDetailPage />} />
          <Route path="dunning" element={<StaffDunningPage />} />
          <Route path="dunning/:id" element={<StaffDunningDetailPage />} />
          <Route path="credit-notes" element={<StaffCreditNotesPage />} />
          <Route path="credit-notes/:id" element={<StaffCreditNoteDetailPage />} />
          <Route path="billing-runs" element={<StaffBillingRunsPage />} />
          <Route path="billing-runs/:id" element={<StaffBillingRunDetailPage />} />
          <Route
            path="finance"
            element={
              <FinanceGuard>
                <StaffFinanceDashboard />
              </FinanceGuard>
            }
          />
          <Route path="integrity" element={<StaffIntegrityPage />} />
          <Route path="notifications" element={<StaffNotificationsPage />} />
          <Route path="404" element={<StaffNotFound />} />
        </Route>

        {/* Protected Admin Destination Placeholder (Phase 4) */}
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
