import AuthLayout from '../components/auth/AuthLayout';
import LoginForm from '../components/auth/LoginForm';

export const AdminLogin = () => {
  return (
    <AuthLayout portalBadge="Admin Console">
      <LoginForm portalId="admin" />
    </AuthLayout>
  );
};

export default AdminLogin;
