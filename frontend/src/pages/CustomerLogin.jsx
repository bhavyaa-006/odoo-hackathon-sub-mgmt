import AuthLayout from '../components/auth/AuthLayout';
import LoginForm from '../components/auth/LoginForm';

export const CustomerLogin = () => {
  return (
    <AuthLayout portalBadge="Customer Portal">
      <LoginForm portalId="customer" />
    </AuthLayout>
  );
};

export default CustomerLogin;
