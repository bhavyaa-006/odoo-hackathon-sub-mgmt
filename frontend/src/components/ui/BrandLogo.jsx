import { Link } from 'react-router-dom';

export const BrandLogo = ({ size = 'default', showTagline = false, clickable = true }) => {
  const iconSize = size === 'large' ? 36 : size === 'small' ? 24 : 28;
  const textSize = size === 'large' ? 'text-2xl' : size === 'small' ? 'text-lg' : 'text-xl';

  const content = (
    <div className="inline-flex items-center gap-2.5 select-none group">
      {/* Brand Icon SVG: Navy loop with mint dynamic curve and amber accent */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="transition-transform duration-200 group-hover:scale-105"
        aria-hidden="true"
      >
        {/* Main navy loop */}
        <circle cx="18" cy="18" r="15" stroke="#1F4E79" strokeWidth="3" />
        {/* Mint recurring loop arc */}
        <path
          d="M10 18C10 13.5817 13.5817 10 18 10C22.4183 10 26 13.5817 26 18"
          stroke="#00796B"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        {/* Amber accent node */}
        <circle cx="26" cy="18" r="3.5" fill="#FFC107" />
        {/* Light teal center pulse */}
        <circle cx="18" cy="18" r="3" fill="#A8D5BA" />
      </svg>

      <div className="flex flex-col">
        <span className={`font-heading font-extrabold tracking-tight text-[#1F4E79] ${textSize} leading-none`}>
          Brightloop
        </span>
        {showTagline && (
          <span className="text-[11px] font-sans font-medium text-[#4B6584] tracking-wide uppercase mt-0.5">
            Subscription Management
          </span>
        )}
      </div>
    </div>
  );

  if (clickable) {
    return (
      <Link
        to="/"
        className="inline-flex focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E88E5] rounded-md"
        aria-label="Brightloop Home"
      >
        {content}
      </Link>
    );
  }

  return content;
};

export default BrandLogo;
