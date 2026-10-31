import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import BrandLogo from '../components/ui/BrandLogo';
import Button from '../components/ui/Button';
import { ROUTES } from '../routes/routeConfig';

export const NotFoundPage = () => {
  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col justify-between p-6 font-sans">
      <header className="max-w-6xl w-full mx-auto">
        <BrandLogo />
      </header>

      <main className="flex-1 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-xl border border-[#4B6584]/20 shadow-elevated p-8 text-center">
          <div className="text-4xl font-heading font-extrabold text-[#1F4E79] mb-2">404</div>
          <h1 className="text-xl font-heading font-bold text-[#333333] mb-2">Page Not Found</h1>
          <p className="text-sm text-[#4B6584] mb-6">
            The page you are looking for does not exist or has been moved.
          </p>
          <Link to={ROUTES.HOME} className="block w-full">
            <Button variant="primary" fullWidth icon={<ArrowLeft className="w-4 h-4" />}>
              Back to Home
            </Button>
          </Link>
        </div>
      </main>

      <footer className="text-center text-xs text-[#4B6584]/60">
        © {new Date().getFullYear()} Brightloop Software Inc.
      </footer>
    </div>
  );
};

export default NotFoundPage;
