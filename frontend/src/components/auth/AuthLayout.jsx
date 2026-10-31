import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import BrandLogo from '../ui/BrandLogo';

export const AuthLayout = ({
  children,
  portalBadge = null,
  showBackToHome = true,
}) => {
  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col justify-between py-8 px-4 sm:px-6 lg:px-8 font-sans">
      {/* Top Bar */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between pb-6">
        <BrandLogo size="default" showTagline />

        {showBackToHome && (
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4B6584] hover:text-[#1F4E79] transition-colors px-3 py-1.5 rounded-lg hover:bg-white/80 border border-transparent hover:border-[#4B6584]/20"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Portals</span>
          </Link>
        )}
      </header>

      {/* Main Centered Content */}
      <main className="flex-1 flex flex-col items-center justify-center py-4">
        {portalBadge && (
          <div className="mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase bg-[#E3F2FD] text-[#1F4E79] border border-[#1F4E79]/20 shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-[#00796B]" />
              {portalBadge}
            </span>
          </div>
        )}

        {children}
      </main>

      {/* Subtle Security & System Footer */}
      <footer className="max-w-md w-full mx-auto text-center pt-8">
        <div className="flex items-center justify-center gap-2 text-xs text-[#4B6584]/80">
          <ShieldCheck className="w-3.5 h-3.5 text-[#00796B]" />
          <span>Secure, role-governed enterprise authentication</span>
        </div>
        <p className="text-[11px] text-[#4B6584]/60 mt-1">
          © {new Date().getFullYear()} Brightloop Software Inc. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default AuthLayout;
