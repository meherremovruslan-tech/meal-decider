'use client';
import { useId } from 'react';

export default function FridgeIcon({ size = 18 }) {
  const gradId = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ verticalAlign: '-3px', flexShrink: 0 }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6c6cff" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <rect x="4" y="2" width="16" height="20" rx="2.5" fill={`url(#${gradId})`} />
      <rect x="4" y="2" width="16" height="20" rx="2.5" stroke="#fff" strokeOpacity="0.15" />
      <line x1="4" y1="9" x2="20" y2="9" stroke="#0f0f1a" strokeWidth="1.2" />
      <line x1="7" y1="4.5" x2="7" y2="6.5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.9" />
      <line x1="7" y1="11" x2="7" y2="14" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.9" />
    </svg>
  );
}
