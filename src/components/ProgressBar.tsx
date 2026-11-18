import React from 'react';
import { POSES } from '../data/exercises';

interface ProgressBarProps {
  value: number;
  max: number;
  tone?: 'primary' | 'secondary' | 'danger' | 'accent';
  label?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max,
  tone = 'primary',
  label,
}) => {
  const pct = Math.min(100, Math.max(0, max > 0 ? (value / max) * 100 : 0));
  const colorMap: Record<NonNullable<ProgressBarProps['tone']>, string> = {
    primary: 'var(--sys-primary)',
    secondary: 'var(--sys-secondary)',
    danger: 'var(--sys-danger)',
    accent: 'var(--sys-accent)',
  };

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      className="h-2 w-full overflow-hidden rounded-full"
      style={{ backgroundColor: 'var(--sys-surface-lowest)' }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300 ease-out"
        style={{
          width: `${pct}%`,
          backgroundColor: colorMap[tone],
        }}
      />
    </div>
  );
};

interface RingGaugeProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  centerText: string;
  subText?: string;
}

export const RingGauge: React.FC<RingGaugeProps> = ({
  value,
  max,
  size = 92,
  strokeWidth = 7,
  color = 'var(--sys-primary)',
  centerText,
  subText,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(1, Math.max(0, max > 0 ? value / max : 0));
  const offset = circumference * (1 - pct);

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--sys-surface-lowest)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-mono-num text-sm font-bold leading-none">{centerText}</span>
        {subText && (
          <span className="mt-0.5 text-[10px]" style={{ color: 'var(--sys-muted)' }}>
            {subText}
          </span>
        )}
      </div>
    </div>
  );
};

export const PoseDiagram: React.FC<{ pose: string }> = ({ pose }) => {
  const o = POSES[pose] || POSES.stand;
  return (
    <svg
      viewBox="0 0 100 66"
      className="max-h-48 w-full rounded-xl"
      style={{ backgroundColor: 'var(--sys-surface-lowest)' }}
      stroke="var(--sys-primary)"
      strokeWidth={3}
      strokeLinecap="round"
      fill="none"
      aria-hidden="true"
    >
      <line x1={4} y1={63} x2={96} y2={63} stroke="var(--sys-border)" strokeWidth={1} />
      <line x1={o.hd[0]} y1={o.hd[1]} x2={o.s[0]} y2={o.s[1]} />
      <circle cx={o.hd[0]} cy={o.hd[1]} r={5} />
      <line x1={o.s[0]} y1={o.s[1]} x2={o.h[0]} y2={o.h[1]} />
      <line x1={o.s[0]} y1={o.s[1]} x2={o.a[0]} y2={o.a[1]} />
      {o.l.map((leg, i) => (
        <React.Fragment key={i}>
          <line x1={o.h[0]} y1={o.h[1]} x2={leg[0]} y2={leg[1]} />
          <line x1={leg[0]} y1={leg[1]} x2={leg[2]} y2={leg[3]} />
        </React.Fragment>
      ))}
    </svg>
  );
};
