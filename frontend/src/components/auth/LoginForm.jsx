import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { ROUTES, PORTAL_CONFIG } from '../../routes/routeConfig';
import AuthCard from '../ui/AuthCard';
import Input from '../ui/Input';
import PasswordInput from '../ui/PasswordInput';
import Checkbox from '../ui/Checkbox';
import Button from '../ui/Button';
import FormError from '../ui/FormError';

const REMEMBER_EMAIL_KEY = 'brightloop_remembered_email';

export const LoginForm = ({ portalId }) => {
  const portal = PORTAL_CONFIG[portalId] || PORTAL_CONFIG.customer;
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem(REMEMBER_EMAIL_KEY) || '';
    } catch {
      return '';
    }
  });

  const [password, setPassword] = useState('');

  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return Boolean(localStorage.getItem(REMEMBER_EMAIL_KEY));
    } catch {
      return false;
    }
  });

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    const newErrors = {};

    if (!email.trim()) {
      newErrors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      newErrors.password = 'Password is required.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      // Execute login and role matching through AuthContext
      await login(portalId, { email: email.trim(), password });

      // Handle remember-me persistence
      try {
        if (rememberMe) {
          localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
        } else {
          localStorage.removeItem(REMEMBER_EMAIL_KEY);
        }
      } catch {
        // ignore
      }

      toast.success(`Signed in to ${portal.title} successfully.`);
      navigate(portal.dashboardPath, { replace: true });
    } catch (err) {
      // Capture error message without exposing backend role or internals
      const message =
        err.userMessage ||
        err.response?.data?.detail ||
        'Unable to sign in. Please verify your credentials and try again.';
      setServerError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthCard>
      {/* Portal Header */}
      <div className="text-center mb-6">
        <h1 className="font-heading font-extrabold text-2xl text-[#333333] tracking-tight">
          {portal.loginTitle}
        </h1>
        <p className="text-sm font-sans text-[#4B6584] mt-1.5 leading-relaxed">
          {portal.loginSubtitle}
        </p>
      </div>

      {/* Global Server Error Alert */}
      {serverError && (
        <div className="mb-5">
          <FormError message={serverError} />
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Input
          id={`${portalId}-email`}
          name="email"
          type="email"
          label="Email address"
          placeholder="name@company.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) setErrors((prev) => ({ ...prev, email: null }));
            if (serverError) setServerError(null);
          }}
          error={errors.email}
          disabled={isSubmitting}
          required
          autoComplete="email"
          leftIcon={<Mail className="w-4 h-4" />}
        />

        <div>
          <PasswordInput
            id={`${portalId}-password`}
            name="password"
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
              if (serverError) setServerError(null);
            }}
            error={errors.password}
            disabled={isSubmitting}
            required
            autoComplete="current-password"
            leftIcon={<Lock className="w-4 h-4" />}
          />

          <div className="flex items-center justify-between mt-2 pt-0.5">
            <Checkbox
              id={`${portalId}-remember`}
              name="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              label="Remember email"
              disabled={isSubmitting}
            />

            <Link
              to={ROUTES.FORGOT_PASSWORD}
              className="text-xs font-semibold text-[#1E88E5] hover:text-[#1565C0] transition-colors focus:outline-none focus-visible:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          fullWidth
          size="md"
          isLoading={isSubmitting}
          className="mt-2"
          icon={<ArrowRight className="w-4 h-4" />}
          iconPosition="right"
        >
          Sign In
        </Button>
      </form>

      {/* Customer Registration Callout */}
      {portalId === 'customer' ? (
        <div className="mt-6 pt-5 border-t border-[#4B6584]/15 text-center text-xs text-[#4B6584]">
          Don't have a subscription account yet?{' '}
          <Link
            to={ROUTES.CUSTOMER_REGISTER}
            className="font-semibold text-[#00796B] hover:text-[#005B51] transition-colors focus:outline-none focus-visible:underline"
          >
            Create customer account
          </Link>
        </div>
      ) : (
        <div className="mt-6 pt-5 border-t border-[#4B6584]/15 text-center text-xs text-[#4B6584]">
          Need access or password reset assistance?{' '}
          <Link
            to={ROUTES.FORGOT_PASSWORD}
            className="font-semibold text-[#1E88E5] hover:text-[#1565C0] transition-colors focus:outline-none focus-visible:underline"
          >
            Reset password
          </Link>
        </div>
      )}
    </AuthCard>
  );
};

export default LoginForm;
