import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, Building, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { ROUTES } from '../routes/routeConfig';
import AuthLayout from '../components/auth/AuthLayout';
import AuthCard from '../components/ui/AuthCard';
import Input from '../components/ui/Input';
import PasswordInput from '../components/ui/PasswordInput';
import Checkbox from '../components/ui/Checkbox';
import Button from '../components/ui/Button';
import FormError from '../components/ui/FormError';
import PasswordChecklist from '../components/ui/PasswordChecklist';
import { isPasswordCompliant } from '../utils/passwordValidation';

export const CustomerRegister = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    acceptTerms: false,
  });

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegisteredSuccess, setIsRegisteredSuccess] = useState(false);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
    if (serverError) setServerError(null);
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Full name is required.';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required.';
    } else if (!isPasswordCompliant(formData.password)) {
      newErrors.password = 'Password must meet all 4 complexity requirements.';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirmation password is required.';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }

    if (!formData.acceptTerms) {
      newErrors.acceptTerms = 'You must accept the terms and conditions to proceed.';
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
      await register({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        company_name: formData.companyName.trim() || undefined,
      });

      setIsRegisteredSuccess(true);
      toast.success('Your customer account was created successfully!');
    } catch (err) {
      if (err.response?.status === 409) {
        setServerError('An account with this email address already exists. Please sign in instead.');
      } else {
        setServerError(
          err.userMessage ||
          err.response?.data?.detail ||
          'Failed to create account. Please check your information and try again.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isRegisteredSuccess) {
    return (
      <AuthLayout portalBadge="Customer Portal">
        <AuthCard>
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-[#E0F2F1] text-[#00796B] mx-auto flex items-center justify-center mb-4">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <h1 className="font-heading font-extrabold text-2xl text-[#333333] mb-2 tracking-tight">
              Account Created!
            </h1>

            <p className="text-sm font-sans text-[#4B6584] leading-relaxed mb-6">
              Welcome to Brightloop, <strong className="text-[#333333]">{formData.name}</strong>. Your subscription management account has been registered. You can now sign in to view your subscriptions and invoices.
            </p>

            <Button
              variant="primary"
              fullWidth
              onClick={() => navigate(ROUTES.CUSTOMER_LOGIN, { replace: true })}
              icon={<ArrowRight className="w-4 h-4" />}
              iconPosition="right"
            >
              Continue to Customer Sign In
            </Button>
          </div>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout portalBadge="Customer Portal">
      <AuthCard className="max-w-[500px]">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="font-heading font-extrabold text-2xl text-[#333333] tracking-tight">
            Create Customer Account
          </h1>
          <p className="text-sm font-sans text-[#4B6584] mt-1.5 leading-relaxed">
            Manage your subscriptions, invoices, and billing in one unified portal.
          </p>
        </div>

        {/* Global Error Banner */}
        {serverError && (
          <div className="mb-5">
            <FormError message={serverError} />
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Input
            id="register-name"
            name="name"
            label="Full name"
            placeholder="Jane Doe"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            error={errors.name}
            disabled={isSubmitting}
            required
            autoComplete="name"
            leftIcon={<User className="w-4 h-4" />}
          />

          <Input
            id="register-email"
            name="email"
            type="email"
            label="Work email address"
            placeholder="jane@company.com"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            error={errors.email}
            disabled={isSubmitting}
            required
            autoComplete="email"
            leftIcon={<Mail className="w-4 h-4" />}
          />

          <Input
            id="register-company"
            name="companyName"
            label="Company name (optional)"
            placeholder="Acme Corporation"
            value={formData.companyName}
            onChange={(e) => handleChange('companyName', e.target.value)}
            disabled={isSubmitting}
            autoComplete="organization"
            leftIcon={<Building className="w-4 h-4" />}
          />

          <div>
            <PasswordInput
              id="register-password"
              name="password"
              label="Create password"
              placeholder="Minimum 9 characters"
              value={formData.password}
              onChange={(e) => handleChange('password', e.target.value)}
              error={errors.password}
              disabled={isSubmitting}
              required
              autoComplete="new-password"
              leftIcon={<Lock className="w-4 h-4" />}
            />

            {/* Live Password Checklist */}
            <div className="mt-3">
              <PasswordChecklist password={formData.password} />
            </div>
          </div>

          <PasswordInput
            id="register-confirm-password"
            name="confirmPassword"
            label="Confirm password"
            placeholder="Re-enter your password"
            value={formData.confirmPassword}
            onChange={(e) => handleChange('confirmPassword', e.target.value)}
            error={errors.confirmPassword}
            disabled={isSubmitting}
            required
            autoComplete="new-password"
            leftIcon={<Lock className="w-4 h-4" />}
          />

          <div className="pt-1">
            <Checkbox
              id="register-terms"
              name="acceptTerms"
              checked={formData.acceptTerms}
              onChange={(e) => handleChange('acceptTerms', e.target.checked)}
              disabled={isSubmitting}
              error={errors.acceptTerms}
              label={
                <span>
                  I agree to the{' '}
                  <span className="font-semibold text-[#1F4E79]">Terms of Service</span> and{' '}
                  <span className="font-semibold text-[#1F4E79]">Privacy Policy</span>.
                </span>
              }
            />
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
            Create Customer Account
          </Button>
        </form>

        <div className="mt-6 pt-5 border-t border-[#4B6584]/15 text-center text-xs text-[#4B6584]">
          Already have an account?{' '}
          <Link
            to={ROUTES.CUSTOMER_LOGIN}
            className="font-semibold text-[#00796B] hover:text-[#005B51] transition-colors focus:outline-none focus-visible:underline"
          >
            Sign in
          </Link>
        </div>
      </AuthCard>
    </AuthLayout>
  );
};

export default CustomerRegister;
