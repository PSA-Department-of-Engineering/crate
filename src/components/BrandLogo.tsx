import React from 'react';

interface BrandLogoProps {
  className?: string;
  size?: number | string;
}

export const BrandLogoMark: React.FC<BrandLogoProps> = ({
  className = 'w-5 h-5',
  size,
}) => (
  <svg
    viewBox="0 0 96 96"
    width={size}
    height={size}
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Crate Logo"
  >
    <rect x="0" y="0" width="96" height="96" rx="22" fill="hsl(160 84% 39%)" />
    <circle cx="39" cy="40" r="18" fill="none" stroke="#FFFFFF" strokeWidth="3.5" opacity="0.85" />
    <circle cx="39" cy="40" r="11" fill="none" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.45" />
    <circle cx="39" cy="40" r="5" fill="#FFFFFF" />
    <circle cx="57" cy="35" r="21" fill="none" stroke="#FFFFFF" strokeWidth="4" opacity="0.95" />
    <circle cx="57" cy="35" r="13" fill="none" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.5" />
    <circle cx="57" cy="35" r="5.5" fill="#FFFFFF" />
    <path
      d="M 20 48 L 76 48 L 73 75 C 72.5 77.5 70.5 79 68 79 L 28 79 C 25.5 79 23.5 77.5 23 75 Z"
      fill="#FFFFFF"
    />
    <rect x="27" y="54" width="42" height="3" rx="1.5" fill="hsl(160 84% 39%)" />
    <rect x="29" y="62" width="38" height="3" rx="1.5" fill="hsl(160 84% 39%)" />
    <rect x="31" y="70" width="34" height="3" rx="1.5" fill="hsl(160 84% 39%)" />
    <rect x="42" y="53" width="12" height="5" rx="2.5" fill="hsl(160 84% 39%)" />
  </svg>
);
