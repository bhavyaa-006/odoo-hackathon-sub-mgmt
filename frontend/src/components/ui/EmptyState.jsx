import { Link } from 'react-router-dom';
import Button from './Button';

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionPath,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`
        bg-white rounded-xl border border-[#4B6584]/20 p-8 sm:p-12 text-center
        flex flex-col items-center justify-center max-w-lg mx-auto my-6
        ${className}
      `}
    >
      {Icon && (
        <div className="w-14 h-14 rounded-full bg-[#E3F2FD] text-[#1F4E79] flex items-center justify-center mb-4">
          <Icon className="w-7 h-7 stroke-[1.75]" aria-hidden="true" />
        </div>
      )}

      <h3 className="font-heading font-bold text-lg text-[#333333] mb-1.5">
        {title}
      </h3>

      <p className="text-sm font-sans text-[#4B6584] max-w-sm mb-6 leading-relaxed">
        {description}
      </p>

      {actionLabel && actionPath && (
        <Link to={actionPath}>
          <Button variant="primary" size="md">
            {actionLabel}
          </Button>
        </Link>
      )}

      {actionLabel && onAction && !actionPath && (
        <Button variant="primary" size="md" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
