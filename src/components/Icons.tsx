import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

export const BasketballIcon: React.FC<IconProps> = ({
  className = '',
  size = 20,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    className={className}
  >
    <circle cx="12" cy="12" r="9.5" fill="#F97316" stroke="#C2410C" strokeWidth="1.2" />
    <path
      d="M12 2.5V21.5M2.5 12H21.5"
      stroke="#431407"
      strokeWidth="1.35"
      strokeLinecap="round"
    />
    <path
      d="M5.4 5.4C8.2 8.2 8.2 15.8 5.4 18.6M18.6 5.4C15.8 8.2 15.8 15.8 18.6 18.6"
      stroke="#431407"
      strokeWidth="1.35"
      strokeLinecap="round"
    />
  </svg>
);

export const BenchIcon: React.FC<IconProps> = ({
  className = '',
  size = 20,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    className={className}
  >
    {/* Minimalist chair / bench silhouette matching Obsidian MinuteTable */}
    <path
      d="M7.5 4.5H16.5V11.5H7.5V4.5Z"
      fill="#8D6E63"
      fillOpacity="0.28"
      stroke="#A1887F"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path
      d="M6.5 13H17.5L18.5 15.5H5.5L6.5 13Z"
      fill="#8D6E63"
      fillOpacity="0.45"
      stroke="#A1887F"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path
      d="M7 15.5L6 20.5M17 15.5L18 20.5M9.5 15.5V19.5M14.5 15.5V19.5"
      stroke="#8D6E63"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export const StopwatchIcon: React.FC<IconProps> = ({
  className = '',
  size = 16,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 1.5" />
    <path d="M10 2h4" />
    <path d="M12 2v3" />
    <path d="M18.5 6.5l1.5-1.5" />
  </svg>
);
