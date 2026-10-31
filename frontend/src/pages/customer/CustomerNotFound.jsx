import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import Button from '../../components/ui/Button';

export const CustomerNotFound = () => {
  return (
    <div className="bg-white rounded-xl border border-[#4B6584]/20 p-8 sm:p-12 text-center max-w-lg mx-auto my-8 shadow-card">
      <div className="w-14 h-14 rounded-full bg-[#FFEBEE] text-[#FF6F61] flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-7 h-7" />
      </div>

      <h1 className="font-heading font-extrabold text-2xl text-[#333333] mb-2 tracking-tight">
        Resource Not Found
      </h1>

      <p className="text-sm font-sans text-[#4B6584] max-w-sm mx-auto mb-6 leading-relaxed">
        The requested record could not be found or you do not have permission to view this customer resource.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link to="/customer">
          <Button variant="primary" size="md">
            Go to Dashboard
          </Button>
        </Link>
        <Link to="/customer/subscriptions">
          <Button variant="outline" size="md">
            View My Subscriptions
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default CustomerNotFound;
