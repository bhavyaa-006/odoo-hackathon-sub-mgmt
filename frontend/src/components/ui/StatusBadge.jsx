import {
  CheckCircle2,
  Clock,
  PauseCircle,
  XCircle,
  AlertTriangle,
  FileText,
  ShieldCheck,
  Check,
} from 'lucide-react';

export const StatusBadge = ({ status = '', type = 'subscription', className = '' }) => {
  const norm = String(status).toLowerCase().replace(/[-\s]/g, '_');

  const configs = {
    // Subscription statuses
    active: {
      label: 'Active',
      bg: 'bg-[#E0F2F1]',
      text: 'text-[#00796B]',
      border: 'border-[#00796B]/25',
      dot: 'bg-[#00796B]',
      icon: CheckCircle2,
    },
    paused: {
      label: 'Paused',
      bg: 'bg-[#FFF9E6]',
      text: 'text-[#D39E00]',
      border: 'border-[#FFC107]/40',
      dot: 'bg-[#FFC107]',
      icon: PauseCircle,
    },
    closed: {
      label: 'Closed',
      bg: 'bg-[#F5F5F5]',
      text: 'text-[#4B6584]',
      border: 'border-[#4B6584]/20',
      dot: 'bg-[#4B6584]',
      icon: XCircle,
    },
    past_due: {
      label: 'Past Due',
      bg: 'bg-[#FFEBEE]',
      text: 'text-[#FF6F61]',
      border: 'border-[#FF6F61]/30',
      dot: 'bg-[#FF6F61]',
      icon: AlertTriangle,
    },
    confirmed: {
      label: 'Confirmed',
      bg: 'bg-[#E3F2FD]',
      text: 'text-[#1F4E79]',
      border: 'border-[#1F4E79]/20',
      dot: 'bg-[#1F4E79]',
      icon: ShieldCheck,
    },
    quotation: {
      label: 'Quotation',
      bg: 'bg-[#E3F2FD]',
      text: 'text-[#1E88E5]',
      border: 'border-[#1E88E5]/25',
      dot: 'bg-[#1E88E5]',
      icon: FileText,
    },
    draft: {
      label: 'Draft',
      bg: 'bg-[#F5F5F5]',
      text: 'text-[#4B6584]',
      border: 'border-[#4B6584]/20',
      dot: 'bg-[#4B6584]',
      icon: Clock,
    },

    // Invoice statuses
    paid: {
      label: 'Paid',
      bg: 'bg-[#E0F2F1]',
      text: 'text-[#00796B]',
      border: 'border-[#00796B]/25',
      dot: 'bg-[#00796B]',
      icon: Check,
    },
    partially_paid: {
      label: 'Partial',
      bg: 'bg-[#FFF9E6]',
      text: 'text-[#D39E00]',
      border: 'border-[#FFC107]/40',
      dot: 'bg-[#FFC107]',
      icon: Clock,
    },
    overdue: {
      label: 'Overdue',
      bg: 'bg-[#FFEBEE]',
      text: 'text-[#FF6F61]',
      border: 'border-[#FF6F61]/30',
      dot: 'bg-[#FF6F61]',
      icon: AlertTriangle,
    },
    cancelled: {
      label: 'Cancelled',
      bg: 'bg-[#F5F5F5]',
      text: 'text-[#4B6584]',
      border: 'border-[#4B6584]/20',
      dot: 'bg-[#4B6584]',
      icon: XCircle,
    },

    // Quotation statuses
    pending: {
      label: 'Pending',
      bg: 'bg-[#FFF9E6]',
      text: 'text-[#D39E00]',
      border: 'border-[#FFC107]/40',
      dot: 'bg-[#FFC107]',
      icon: Clock,
    },
    accepted: {
      label: 'Accepted',
      bg: 'bg-[#E0F2F1]',
      text: 'text-[#00796B]',
      border: 'border-[#00796B]/25',
      dot: 'bg-[#00796B]',
      icon: CheckCircle2,
    },
    expired: {
      label: 'Expired',
      bg: 'bg-[#FFEBEE]',
      text: 'text-[#FF6F61]',
      border: 'border-[#FF6F61]/30',
      dot: 'bg-[#FF6F61]',
      icon: AlertTriangle,
    },
  };

  const config = configs[norm] || {
    label: status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown',
    bg: 'bg-[#F5F5F5]',
    text: 'text-[#4B6584]',
    border: 'border-[#4B6584]/20',
    dot: 'bg-[#4B6584]',
    icon: Clock,
  };

  const IconComponent = config.icon;

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border
        ${config.bg} ${config.text} ${config.border} ${className}
      `}
      role="status"
      aria-label={`${type} status: ${config.label}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} aria-hidden="true" />
      <IconComponent className="w-3 h-3 shrink-0 stroke-[2.5]" aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
};

export default StatusBadge;
