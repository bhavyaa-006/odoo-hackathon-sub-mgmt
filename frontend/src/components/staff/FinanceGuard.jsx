import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export const FinanceGuard = ({ children }) => {
  const { user } = useAuth();

  const hasFinanceAccess =
    user?.role === 'admin' ||
    user?.role === 'finance' ||
    (Array.isArray(user?.permissions) && user.permissions.includes('finance'));

  if (!hasFinanceAccess) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center max-w-xl mx-auto my-12 shadow-xs">
        <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-100">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold font-heading text-[#1F4E79]">
          Restricted to Finance Roles
        </h2>
        <p className="text-xs text-[#4B6584] mt-2 leading-relaxed">
          The Executive Finance Dashboard and MRR waterfall analysis are restricted to users with
          Finance permissions or Administrator privileges.
        </p>
        <div className="mt-6">
          <Link
            to="/staff"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#1F4E79] hover:bg-[#163a5c] rounded-xl transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Staff Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  return children;
};

export default FinanceGuard;
