import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  User,
  Building,
  Mail,
  Phone,
  MapPin,
  Lock,
  Save,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import customerService from '../../../services/customer.service';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { CardSkeleton } from '../../../components/ui/Skeleton';
import { useToast } from '../../../hooks/useToast';
import { useAuth } from '../../../hooks/useAuth';

export const ProfilePage = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    company_name: '',
    gstin: '',
    billing_address: '',
    state: '',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const data = await customerService.getProfile();
        if (isMounted) {
          setProfile(data);
          setFormData({
            name: data.name || '',
            phone: data.phone || '',
            company_name: data.company_name || '',
            gstin: data.gstin || '',
            billing_address: data.billing_address || '',
            state: data.state || '',
          });
        }
      } catch (err) {
        if (isMounted) {
          setError(err.userMessage || 'Failed to retrieve profile information.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (field, val) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
    if (error) setError(null);
    if (successMsg) setSuccessMsg(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Customer name cannot be empty.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const updated = await customerService.updateProfile(formData);
      setProfile(updated);
      setIsEditing(false);
      const msg = updated.is_simulated
        ? 'Profile updated locally (Mock Mode).'
        : 'Profile details updated successfully.';
      setSuccessMsg(msg);
      toast.success(msg);
    } catch (err) {
      setError(err.userMessage || 'Failed to update profile. Please verify your data.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError(null);
    if (profile) {
      setFormData({
        name: profile.name || '',
        phone: profile.phone || '',
        company_name: profile.company_name || '',
        gstin: profile.gstin || '',
        billing_address: profile.billing_address || '',
        state: profile.state || '',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Title */}
      <div>
        <h1 className="font-heading font-extrabold text-2xl text-[#1F4E79] tracking-tight">
          Customer Profile & Billing Information
        </h1>
        <p className="text-xs text-[#4B6584] mt-0.5">
          Manage your organization details, GST tax identifier, and billing contacts
        </p>
      </div>

      {/* Success Banner */}
      {successMsg && (
        <div className="p-3.5 bg-[#E0F2F1] border border-[#00796B]/30 rounded-xl flex items-center gap-2 text-xs text-[#005B51] font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-3.5 bg-[#FFEBEE] border border-[#FF6F61]/30 rounded-xl flex items-center gap-2 text-xs text-[#FF6F61] font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Section 1: Organization & Contact Profile */}
      <section className="bg-white rounded-xl border border-[#4B6584]/20 shadow-card p-6 sm:p-8">
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-[#4B6584]/15">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-[#1F4E79]" />
            <h2 className="font-heading font-bold text-lg text-[#1F4E79]">
              Organization & Tax Information
            </h2>
          </div>

          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              Edit Details
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                isLoading={isSaving}
                icon={<Save className="w-3.5 h-3.5" />}
              >
                Save Changes
              </Button>
            </div>
          )}
        </div>

        <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="prof-name"
            name="name"
            label="Primary Contact / Customer Name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            disabled={!isEditing || isSaving}
            required
            leftIcon={<User className="w-4 h-4" />}
          />

          <Input
            id="prof-email"
            name="email"
            label="Account Email Address (Read-only Identifier)"
            value={profile?.email || user?.email || ''}
            disabled={true}
            helperText="Protected account identifier managed by authentication"
            leftIcon={<Mail className="w-4 h-4" />}
          />

          <Input
            id="prof-phone"
            name="phone"
            label="Contact Phone"
            placeholder="+91 98765 43210"
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            disabled={!isEditing || isSaving}
            leftIcon={<Phone className="w-4 h-4" />}
          />

          <Input
            id="prof-company"
            name="company_name"
            label="Organization / Legal Company Name"
            placeholder="Company Name"
            value={formData.company_name}
            onChange={(e) => handleChange('company_name', e.target.value)}
            disabled={!isEditing || isSaving}
            leftIcon={<Building className="w-4 h-4" />}
          />

          <Input
            id="prof-gstin"
            name="gstin"
            label="GSTIN Identifier"
            placeholder="29ABCDE1234F1Z5"
            value={formData.gstin}
            onChange={(e) => handleChange('gstin', e.target.value.toUpperCase())}
            disabled={!isEditing || isSaving}
            helperText="Used for tax invoice generation and input tax credit"
          />

          <Input
            id="prof-state"
            name="state"
            label="Billing State / Jurisdiction"
            placeholder="Karnataka"
            value={formData.state}
            onChange={(e) => handleChange('state', e.target.value)}
            disabled={!isEditing || isSaving}
          />

          <div className="sm:col-span-2">
            <Input
              id="prof-address"
              name="billing_address"
              label="Complete Billing Address"
              placeholder="Suite / Street / City / PIN"
              value={formData.billing_address}
              onChange={(e) => handleChange('billing_address', e.target.value)}
              disabled={!isEditing || isSaving}
              leftIcon={<MapPin className="w-4 h-4" />}
            />
          </div>
        </form>
      </section>

      {/* Section 2: Account Security & Password Recovery */}
      <section className="bg-white rounded-xl border border-[#4B6584]/20 shadow-card p-6 sm:p-8">
        <div className="flex items-center gap-2 pb-4 mb-4 border-b border-[#4B6584]/15">
          <Lock className="w-5 h-5 text-[#00796B]" />
          <h2 className="font-heading font-bold text-lg text-[#1F4E79]">
            Account Security & Credentials
          </h2>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-[#F5F5F5] border border-[#4B6584]/15">
          <div>
            <h3 className="font-bold text-xs text-[#333333]">
              Password Management
            </h3>
            <p className="text-xs text-[#4B6584] mt-0.5">
              To update your account password, request an authenticated password reset link sent to your registered email address.
            </p>
          </div>

          <Link to="/forgot-password" target="_blank" rel="noopener noreferrer">
            <Button
              variant="outline"
              size="sm"
              icon={<ExternalLink className="w-3.5 h-3.5" />}
              iconPosition="right"
            >
              Reset Password
            </Button>
          </Link>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-[#4B6584]">
          <ShieldCheck className="w-4 h-4 text-[#00796B]" />
          <span>Session protected with JWT bearer tokens and strict customer role verification.</span>
        </div>
      </section>
    </div>
  );
};

export default ProfilePage;
