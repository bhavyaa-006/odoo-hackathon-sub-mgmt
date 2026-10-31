import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import authService from '../services/auth.service';
import { ROUTES } from '../routes/routeConfig';
import AuthLayout from '../components/auth/AuthLayout';
import AuthCard from '../components/ui/AuthCard';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import FormError from '../components/ui/FormError';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [serverError, setServerError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);

    if (!email.trim()) {
      setError('Email address is required.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);

    try {
      await authService.forgotPassword({ email: email.trim() });
      setIsSubmitted(true);
    } catch (err) {
      if (!err.response) {
        setServerError('Cannot connect to authentication server. Please check your network and retry.');
      } else {
        setIsSubmitted(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout showBackToHome>
      <AuthCard>
        {isSubmitted ? (
          <div className="text-center py-3">
            <div className="w-12 h-12 rounded-full bg-[#E0F2F1] text-[#00796B] mx-auto flex items-center justify-center mb-4">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <h1 className="font-heading font-extrabold text-2xl text-[#333333] mb-2 tracking-tight">
              Check Your Inbox
            </h1>

            <p className="text-sm font-sans text-[#4B6584] leading-relaxed mb-6">
              If an account exists for <strong className="text-[#333333]">{email}</strong>, password reset instructions have been sent.
            </p>

            <div className="p-3.5 bg-[#E3F2FD] rounded-lg border border-[#B3D7F5] text-xs text-[#1F4E79] text-left mb-6">
              <p className="font-semibold mb-1">Tip for development & testing:</p>
              <p>In accordance with platform specifications, reset emails are logged in the backend email outbox. Copy the generated reset token or visit the link provided.</p>
            </div>

            <div className="space-y-2.5">
              <Link to={ROUTES.HOME} className="block w-full">
                <Button variant="primary" fullWidth>
                  Return to Home
                </Button>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setIsSubmitted(false);
                  setEmail('');
                }}
                className="text-xs font-semibold text-[#4B6584] hover:text-[#1F4E79] transition-colors py-2"
              >
                Send to a different email
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="text-center mb-6">
              <h1 className="font-heading font-extrabold text-2xl text-[#333333] tracking-tight">
                Reset Password
              </h1>
              <p className="text-sm font-sans text-[#4B6584] mt-1.5 leading-relaxed">
                Enter your registered email address. If an account exists, we'll send instructions to reset your password.
              </p>
            </div>

            {serverError && (
              <div className="mb-5">
                <FormError message={serverError} />
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <Input
                id="forgot-email"
                name="email"
                type="email"
                label="Registered email address"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                  if (serverError) setServerError(null);
                }}
                error={error}
                disabled={isSubmitting}
                required
                autoComplete="email"
                leftIcon={<Mail className="w-4 h-4" />}
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
                Send reset link
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-[#4B6584]/15 flex items-center justify-center gap-1.5 text-xs text-[#4B6584]">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to</span>
              <Link
                to={ROUTES.CUSTOMER_LOGIN}
                className="font-semibold text-[#1F4E79] hover:underline"
              >
                Customer
              </Link>
              <span>•</span>
              <Link
                to={ROUTES.STAFF_LOGIN}
                className="font-semibold text-[#1F4E79] hover:underline"
              >
                Staff
              </Link>
              <span>•</span>
              <Link
                to={ROUTES.ADMIN_LOGIN}
                className="font-semibold text-[#1F4E79] hover:underline"
              >
                Admin
              </Link>
            </div>
          </div>
        )}
      </AuthCard>
    </AuthLayout>
  );
};

export default ForgotPassword;
