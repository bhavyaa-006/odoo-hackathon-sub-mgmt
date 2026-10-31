import { useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Briefcase,
  Shield,
  ArrowRight,
  ShieldCheck,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ROUTES, ROLE_DESTINATIONS } from '../routes/routeConfig';
import BrandLogo from '../components/ui/BrandLogo';
import PortalCard from '../components/ui/PortalCard';
import Button from '../components/ui/Button';

export const LandingPage = () => {
  const portalSectionRef = useRef(null);
  const { user, isAuthenticated, logout } = useAuth();

  const scrollToPortals = () => {
    portalSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col font-sans selection:bg-[#E3F2FD] selection:text-[#1F4E79]">
      {/* 6.1 Clean, Enterprise Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-[#4B6584]/20 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <BrandLogo size="default" showTagline />

          {/* Minimal Navigation & Auth Shortcut */}
          <nav className="flex items-center gap-3 sm:gap-4" aria-label="Main Navigation">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline text-xs text-[#4B6584]">
                  Signed in as <strong className="text-[#333333] capitalize">{user.role}</strong> ({user.name || user.email})
                </span>
                <Link to={ROLE_DESTINATIONS[user.role?.toLowerCase()] || ROUTES.CUSTOMER_DASHBOARD}>
                  <Button variant="primary" size="sm">
                    Open Workspace
                  </Button>
                </Link>
                <button
                  onClick={logout}
                  className="text-xs font-semibold text-[#4B6584] hover:text-[#FF6F61] transition-colors px-2 py-1"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={scrollToPortals}
                  className="hidden md:inline-flex text-xs font-semibold text-[#4B6584] hover:text-[#1F4E79] transition-colors px-3 py-1.5"
                >
                  Select Portal
                </button>
                <Link to={ROUTES.CUSTOMER_LOGIN}>
                  <Button variant="outline" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link to={ROUTES.CUSTOMER_REGISTER} className="hidden sm:inline-flex">
                  <Button variant="secondary" size="sm">
                    Register
                  </Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="grow">
        {/* 6.2 Hero Section */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-b border-[#4B6584]/15 bg-white">
          <div className="max-w-4xl mx-auto text-center">
            {/* Supporting label */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E3F2FD] border border-[#1F4E79]/20 text-[#1F4E79] text-xs font-semibold tracking-wide uppercase mb-6 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-[#00796B]" />
              Brightloop Subscription Management
            </div>

            {/* Headline */}
            <h1 className="font-heading font-extrabold text-4xl sm:text-5xl lg:text-6xl text-[#1F4E79] tracking-tight leading-[1.15] mb-6">
              Subscription management, simplified.
            </h1>

            {/* Supporting Text */}
            <p className="font-sans text-lg sm:text-xl text-[#4B6584] max-w-2xl mx-auto leading-relaxed mb-10">
              One unified workspace to manage subscriptions, automate billing and gain complete visibility into your recurring revenue.
            </p>

            {/* Hero CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-md mx-auto">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={scrollToPortals}
                icon={<ArrowRight className="w-5 h-5" />}
                iconPosition="right"
              >
                Get started
              </Button>
              <Link to={ROUTES.CUSTOMER_REGISTER} className="w-full">
                <Button
                  variant="outline"
                  size="lg"
                  fullWidth
                >
                  Create customer account
                </Button>
              </Link>
            </div>

            {/* Trust / Capability Badges */}
            <div className="pt-12 mt-12 border-t border-[#4B6584]/10 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-[#E3F2FD] text-[#1F4E79] shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-sm text-[#333333]">Role-Governed Portals</h4>
                  <p className="text-xs text-[#4B6584] mt-0.5">Strict authorization boundaries for Customers, Staff, and Admins.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-[#E0F2F1] text-[#00796B] shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-sm text-[#333333]">Flexible Lifecycle</h4>
                  <p className="text-xs text-[#4B6584] mt-0.5">Automated billing cycles, fixed-term and indefinite plans.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-[#E3F2FD] text-[#1F4E79] shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-sm text-[#333333]">Billing & Invoices</h4>
                  <p className="text-xs text-[#4B6584] mt-0.5">Accurate invoice generation with automated tax and discounts.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6.3 Portal Selection Section */}
        <section
          ref={portalSectionRef}
          id="portals"
          className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
        >
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-heading font-extrabold text-3xl text-[#1F4E79] tracking-tight mb-3">
              Select Your Workspace
            </h2>
            <p className="text-sm sm:text-base font-sans text-[#4B6584] leading-relaxed">
              Brightloop provides dedicated interfaces tailored for each role in the subscription lifecycle.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
            {/* Portal 1: Customer Portal */}
            <PortalCard
              title="Customer Portal"
              tagline="Self-Service"
              description="Manage your subscriptions, track invoices and stay on top of your payments."
              features={[
                'View subscriptions',
                'Manage billing',
                'Track invoices',
              ]}
              icon={Users}
              loginPath={ROUTES.CUSTOMER_LOGIN}
              loginLabel="Customer Login"
              registerPath={ROUTES.CUSTOMER_REGISTER}
              registerLabel="Create Account"
              accent="teal"
            />

            {/* Portal 2: Staff Workspace */}
            <PortalCard
              title="Staff Workspace"
              tagline="Operations"
              description="Manage customers, quotations, subscriptions and day-to-day billing operations."
              features={[
                'Customer management',
                'Quotations',
                'Billing operations',
              ]}
              icon={Briefcase}
              loginPath={ROUTES.STAFF_LOGIN}
              loginLabel="Staff Login"
              accent="slate"
            />

            {/* Portal 3: Admin Console */}
            <PortalCard
              title="Admin Console"
              tagline="Configuration"
              description="Configure products, plans, pricing, taxes, discounts and platform operations."
              features={[
                'Product configuration',
                'Plan management',
                'Staff management',
              ]}
              icon={Shield}
              loginPath={ROUTES.ADMIN_LOGIN}
              loginLabel="Admin Login"
              accent="navy"
            />
          </div>

          {/* Quick Help Link */}
          <div className="mt-12 text-center text-xs text-[#4B6584]">
            Forgot your credentials?{' '}
            <Link
              to={ROUTES.FORGOT_PASSWORD}
              className="font-semibold text-[#1E88E5] hover:text-[#1565C0] transition-colors underline"
            >
              Reset your password
            </Link>
          </div>
        </section>
      </main>

      {/* 6.5 Footer */}
      <footer className="bg-white border-t border-[#4B6584]/20 py-10 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start">
            <BrandLogo size="small" clickable={false} />
            <p className="text-xs text-[#4B6584] mt-2 text-center md:text-left max-w-sm">
              Unified enterprise subscription management, automated billing, and quotation lifecycle platform.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-[#4B6584]">
            <Link to={ROUTES.CUSTOMER_LOGIN} className="hover:text-[#1F4E79] transition-colors">
              Customer Portal
            </Link>
            <Link to={ROUTES.STAFF_LOGIN} className="hover:text-[#1F4E79] transition-colors">
              Staff Workspace
            </Link>
            <Link to={ROUTES.ADMIN_LOGIN} className="hover:text-[#1F4E79] transition-colors">
              Admin Console
            </Link>
            <Link to={ROUTES.FORGOT_PASSWORD} className="hover:text-[#1F4E79] transition-colors">
              Reset Password
            </Link>
          </div>

          <div className="text-xs text-[#4B6584]/70 text-center md:text-right">
            © {new Date().getFullYear()} Brightloop Software Inc. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
