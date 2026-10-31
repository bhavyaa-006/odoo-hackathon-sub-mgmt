import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Lock, ArrowRight, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';
import authService from '../services/auth.service';
import { useToast } from '../hooks/useToast';
import { ROUTES } from '../routes/routeConfig';
import AuthLayout from '../components/auth/AuthLayout';
import AuthCard from '../components/ui/AuthCard';
import PasswordInput from '../components/ui/PasswordInput';
import Button from '../components/ui/Button';
import FormError from '../components/ui/FormError';
import PasswordChecklist from '../components/ui/PasswordChecklist';
import { isPasswordCompliant } from '../utils/passwordValidation';

export const ResetPassword = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  const tokenFromUrl = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Check if token exists on mount
  const hasToken = Boolean(tokenFromUrl && tokenFromUrl.trim().length > 0);

  const validate = () => {
    const newErrors = {};

    if (!password) {
      newErrors.password = 'New password is required.';
    } else if (!isPasswordCompliant(password)) {
      newErrors.password = 'Password does not satisfy all complexity requirements.';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Confirmation password is required.';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);

    if (!hasToken) {
      setServerError('Missing reset token. Please use the complete link sent to your email.');
      return;
    }

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      await authService.resetPassword({
        token: tokenFromUrl,
        new_password: password,
      });

      // Clear token from URL using replace to avoid token remaining in browser history
      setSearchParams({}, { replace: true });
      setIsSuccess(true);
      toast.success('Your password has been reset successfully.');
    } catch (err) {
      const message =
        err.userMessage ||
        err.response?.data?.detail ||
        'Failed to reset password. The link may have expired or is invalid.';
      setServerError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout showBackToHome>
      <AuthCard className="max-w-[480px]">
        {isSuccess ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-[#E0F2F1] text-[#00796B] mx-auto flex items-center justify-center mb-4">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <h1 className="font-heading font-extrabold text-2xl text-[#333333] mb-2 tracking-tight">
              Password Reset Complete
            </h1>

            <p className="text-sm font-sans text-[#4B6584] leading-relaxed mb-6">
              Your password has been successfully updated. You can now use your new password to sign in to your workspace.
            </p>

            <div className="space-y-2.5">
              <Link to={ROUTES.CUSTOMER_LOGIN} className="block w-full">
                <Button variant="primary" fullWidth icon={<ArrowRight className="w-4 h-4" />} iconPosition="right">
                  Customer Sign In
                </Button>
              </Link>
              <div className="flex items-center justify-center gap-3 pt-2 text-xs text-[#4B6584]">
                <span>Other portals:</span>
                <Link to={ROUTES.STAFF_LOGIN} className="font-semibold text-[#1F4E79] hover:underline">
                  Staff
                </Link>
                <span>•</span>
                <Link to={ROUTES.ADMIN_LOGIN} className="font-semibold text-[#1F4E79] hover:underline">
                  Admin
                </Link>
              </div>
            </div>
          </div>
        ) : !hasToken ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-[#FFF9E6] text-[#FFC107] mx-auto flex items-center justify-center mb-4 border border-[#FFC107]/40">
              <AlertTriangle className="w-6 h-6 text-[#D39E00]" />
            </div>

            <h1 className="font-heading font-extrabold text-2xl text-[#333333] mb-2 tracking-tight">
              Invalid Reset Link
            </h1>

            <p className="text-sm font-sans text-[#4B6584] leading-relaxed mb-6">
              No reset token was found in this URL. Password reset links are unique and time-limited.
            </p>

            <div className="space-y-2.5">
              <Link to={ROUTES.FORGOT_PASSWORD} className="block w-full">
                <Button variant="primary" fullWidth>
                  Request New Reset Link
                </Button>
              </Link>
              <Link to={ROUTES.HOME} className="block w-full">
                <Button variant="outline" fullWidth>
                  Return to Home
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div>
            <div className="text-center mb-6">
              <h1 className="font-heading font-extrabold text-2xl text-[#333333] tracking-tight">
                Set New Password
              </h1>
              <p className="text-sm font-sans text-[#4B6584] mt-1.5 leading-relaxed">
                Choose a strong new password for your Brightloop account.
              </p>
            </div>

            {serverError && (
              <div className="mb-5">
                <FormError message={serverError} />
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <PasswordInput
                  id="reset-password"
                  name="password"
                  label="New password"
                  placeholder="Minimum 9 characters"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
                    if (serverError) setServerError(null);
                  }}
                  error={errors.password}
                  disabled={isSubmitting}
                  required
                  autoComplete="new-password"
                  leftIcon={<Lock className="w-4 h-4" />}
                />

                <div className="mt-3">
                  <PasswordChecklist password={password} />
                </div>
              </div>

              <PasswordInput
                id="reset-confirm-password"
                name="confirmPassword"
                label="Confirm new password"
                placeholder="Re-enter your new password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirmPassword) {
                    setErrors((prev) => ({ ...prev, confirmPassword: null }));
                  }
                  if (serverError) setServerError(null);
                }}
                error={errors.confirmPassword}
                disabled={isSubmitting}
                required
                autoComplete="new-password"
                leftIcon={<Lock className="w-4 h-4" />}
              />

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
                Reset Password
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-[#4B6584]/15 text-center text-xs text-[#4B6584]">
              <Link
                to={ROUTES.HOME}
                className="inline-flex items-center gap-1 font-semibold text-[#1F4E79] hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Cancel and return to home
              </Link>
            </div>
          </div>
        )}
      </AuthCard>
    </AuthLayout>
  );
};

export default ResetPassword;
