import { Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';

export const StaffNotFound = () => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto my-12 shadow-xs">
      <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
      <h2 className="text-xl font-bold font-heading text-[#1F4E79]">
        Staff Workspace Record Not Found (404)
      </h2>
      <p className="text-xs text-[#4B6584] mt-2 leading-relaxed">
        The operations resource or route you requested does not exist or has been archived.
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
};

export default StaffNotFound;
