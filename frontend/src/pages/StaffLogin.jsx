import AuthLayout from '../components/auth/AuthLayout';
import LoginForm from '../components/auth/LoginForm';

export const StaffLogin = () => {
  return (
    <AuthLayout portalBadge="Staff Workspace">
      <LoginForm portalId="staff" />
    </AuthLayout>
  );
};

export default StaffLogin;
