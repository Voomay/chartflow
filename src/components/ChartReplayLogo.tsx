import React, { useId } from 'react';

interface ChartReplayMarkProps {
  size?: number;
  className?: string;
}

/** Icon mark: rounded tile with candlesticks wrapped by a replay (rewind) arrow. */
export const ChartReplayMark: React.FC<ChartReplayMarkProps> = ({ size = 36, className = '' }) => {
  const uid = useId().replace(/:/g, '');
  const bg = `crl-bg-${uid}`;
  const fg = `crl-fg-${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`shrink-0 ${className}`}
      role="img"
      aria-label="Chart Replay logo"
    >
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
        <linearGradient id={fg} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#d1fae5" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill={`url(#${bg})`} />
      <rect x="2.5" y="2.5" width="59" height="59" rx="15.5" fill="none" stroke="#fff" strokeOpacity="0.22" />
      {/* Replay arc (counter-clockwise) */}
      <path
        d="M47.5 21.5A19 19 0 1 0 51 32"
        fill="none"
        stroke={`url(#${fg})`}
        strokeWidth="4.2"
        strokeLinecap="round"
      />
      <path d="M41.5 14.5 L52 17.5 L46.5 27 Z" fill="#fff" strokeLinejoin="round" />
      {/* Candlesticks */}
      <g stroke="#fff" strokeWidth="2" strokeLinecap="round">
        <line x1="24" y1="25" x2="24" y2="43" />
        <line x1="32" y1="20" x2="32" y2="40" />
        <line x1="40" y1="27" x2="40" y2="41" />
      </g>
      <rect x="21" y="30" width="6" height="9" rx="1.5" fill="#fff" />
      <rect x="29" y="24" width="6" height="11" rx="1.5" fill="#064e3b" stroke="#fff" strokeWidth="1.6" />
      <rect x="37" y="30" width="6" height="7" rx="1.5" fill="#fff" />
    </svg>
  );
};

interface ChartReplayLogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
  textClassName?: string;
}

/** Mark + "Chart Replay" wordmark. */
export const ChartReplayLogo: React.FC<ChartReplayLogoProps> = ({
  size = 36,
  showText = true,
  className = '',
  textClassName = '',
}) => (
  <span className={`inline-flex items-center gap-2.5 min-w-0 ${className}`}>
    <ChartReplayMark size={size} className="drop-shadow-[0_0_14px_rgba(16,185,129,0.45)]" />
    {showText && (
      <span
        className={`font-extrabold tracking-tight text-white whitespace-nowrap leading-tight ${textClassName}`}
        style={{ fontSize: Math.max(13, size * 0.46) }}
      >
        Chart{' '}
        <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent pb-0.5">Replay</span>
      </span>
    )}
  </span>
);

export default ChartReplayLogo;
