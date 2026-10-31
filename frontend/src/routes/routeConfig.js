export const ROUTES = {
  HOME: '/',
  CUSTOMER_LOGIN: '/customer/login',
  STAFF_LOGIN: '/staff/login',
  ADMIN_LOGIN: '/admin/login',
  CUSTOMER_REGISTER: '/customer/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  CUSTOMER_DASHBOARD: '/customer',
  STAFF_DASHBOARD: '/staff',
  ADMIN_DASHBOARD: '/admin',
};

export const ROLE_DESTINATIONS = {
  customer: ROUTES.CUSTOMER_DASHBOARD,
  staff: ROUTES.STAFF_DASHBOARD,
  finance: ROUTES.STAFF_DASHBOARD,
  admin: ROUTES.ADMIN_DASHBOARD,
};

export const PORTAL_CONFIG = {
  customer: {
    portalId: 'customer',
    title: 'Customer Portal',
    loginTitle: 'Welcome back',
    loginSubtitle: 'Access your subscriptions, invoices, and billing.',
    loginPath: ROUTES.CUSTOMER_LOGIN,
    dashboardPath: ROUTES.CUSTOMER_DASHBOARD,
    allowedRoles: ['customer'],
    accentColor: 'teal',
  },
  staff: {
    portalId: 'staff',
    title: 'Staff Workspace',
    loginTitle: 'Staff Workspace',
    loginSubtitle: 'Sign in to manage customers and subscription operations.',
    loginPath: ROUTES.STAFF_LOGIN,
    dashboardPath: ROUTES.STAFF_DASHBOARD,
    allowedRoles: ['staff', 'finance'],
    accentColor: 'slateblue',
  },
  admin: {
    portalId: 'admin',
    title: 'Admin Console',
    loginTitle: 'Admin Console',
    loginSubtitle: 'Access platform configuration and administrative controls.',
    loginPath: ROUTES.ADMIN_LOGIN,
    dashboardPath: ROUTES.ADMIN_DASHBOARD,
    allowedRoles: ['admin'],
    accentColor: 'navy',
  },
};
