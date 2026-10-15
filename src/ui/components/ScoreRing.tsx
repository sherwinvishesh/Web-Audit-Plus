import { useEffect, useState } from 'react';
import { band, BAND_COLOR } from '../lib/score';

interface ScoreRingProps {
  score: number | null | undefined;
  size?: number;
  /** Still being measured: an indeterminate arc. */
  pending?: boolean;
  /** Animate from empty on first render. */
  animate?: boolean;
  label?: string;
}

/**
 * A score gauge. The arc color is the score band; the number sits in the middle in tabular
 * figures. A missing score draws an empty track and a dash, never a zero.
 */
export function ScoreRing({ score, size = 56, pending = false, animate = true, label }: ScoreRingProps) {
  const value = typeof score === 'number' && Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null;
  const [shown, setShown] = useState(animate ? 0 : (value ?? 0));

  useEffect(() => {
    if (!animate) {
      setShown(value ?? 0);
      return;
    }
    const frame = requestAnimationFrame(() => setShown(value ?? 0));
    return () => cancelAnimationFrame(frame);
  }, [animate, value]);

  const stroke = Math.max(3, Math.round(size / 13));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = BAND_COLOR[band(value)];
  const fontSize = size >= 80 ? Math.round(size * 0.3) : Math.round(size * 0.32);

  return (
    <div
      className="relative inline-grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label ? `${label}: ` : ''}${pending ? 'measuring' : value === null ? 'no score' : `${Math.round(value)} out of 100`}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        {pending ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.22} ${circumference}`}
            className="origin-center animate-spin [animation-duration:1.1s]"
          />
        ) : value !== null ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - shown / 100)}
            className="transition-[stroke-dashoffset] duration-[900ms] ease-[cubic-bezier(.2,.7,.2,1)] motion-reduce:transition-none"
          />
        ) : null}
      </svg>
      <span
        className="num absolute font-semibold leading-none tracking-tight"
        style={{ fontSize, color: pending || value === null ? 'var(--faint)' : color }}
        aria-hidden="true"
      >
        {pending ? '' : value === null ? '–' : Math.round(value)}
      </span>
    </div>
  );
}
