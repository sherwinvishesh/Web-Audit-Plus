import type { ReactNode, SVGProps } from 'react';

/** A small set of stroke icons on a 16px grid, drawn for this UI. */
type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number };

function Icon({ size = 16, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3.5 8.5l3 3 6-7" />
  </Icon>
);

export const CrossIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
  </Icon>
);

export const DashIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4.5 8h7" />
  </Icon>
);

export const CircleIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="8" cy="8" r="4.5" />
  </Icon>
);

export const HalfIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="8" cy="8" r="4.5" />
    <path d="M8 3.5a4.5 4.5 0 010 9z" fill="currentColor" stroke="none" />
  </Icon>
);

export const LockIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3.5" y="7" width="9" height="6" rx="1.5" />
    <path d="M5.5 7V5.5a2.5 2.5 0 015 0V7" />
  </Icon>
);

export const ChevronIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 4l4 4-4 4" />
  </Icon>
);

export const CopyIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="5.5" y="5.5" width="7.5" height="7.5" rx="1.5" />
    <path d="M10.5 3.5V3A1.5 1.5 0 009 1.5H4A1.5 1.5 0 002.5 3v5A1.5 1.5 0 004 9.5h.5" />
  </Icon>
);

export const ExternalIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9.5 2.5h4v4M13.5 2.5L8 8M11.5 9.5v3a1 1 0 01-1 1h-7a1 1 0 01-1-1v-7a1 1 0 011-1h3" />
  </Icon>
);

export const SunIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="8" cy="8" r="2.75" />
    <path d="M8 1.5v1.25M8 13.25v1.25M1.5 8h1.25M13.25 8h1.25M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9" />
  </Icon>
);

export const MoonIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M13 9.5A5.5 5.5 0 016.5 3a5.5 5.5 0 106.5 6.5z" />
  </Icon>
);

export const DesktopIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="1.5" y="2.5" width="13" height="8.5" rx="1.25" />
    <path d="M5.5 13.5h5M8 11v2.5" />
  </Icon>
);

export const MobileIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="4.25" y="1.5" width="7.5" height="13" rx="1.5" />
    <path d="M7.25 12.25h1.5" />
  </Icon>
);

export const HistoryIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.5 8a5.5 5.5 0 101.6-3.9" />
    <path d="M2.5 2.5v2.25h2.25M8 5v3l2 1.5" />
  </Icon>
);

export const SearchIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="7" cy="7" r="4.25" />
    <path d="M10.25 10.25l3.25 3.25" />
  </Icon>
);

export const GlobeIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="8" cy="8" r="6" />
    <path d="M2 8h12M8 2c-1.7 1.7-2.5 3.7-2.5 6s.8 4.3 2.5 6M8 2c1.7 1.7 2.5 3.7 2.5 6s-.8 4.3-2.5 6" />
  </Icon>
);

export const DownloadIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 2v8M4.75 7L8 10.25 11.25 7M2.5 13.5h11" />
  </Icon>
);

export const FileIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9.25 1.75H4.5a1 1 0 00-1 1v10.5a1 1 0 001 1h7a1 1 0 001-1V5L9.25 1.75z" />
    <path d="M9.25 1.75V5h3.25M5.75 8.25h4.5M5.75 10.75h3" />
  </Icon>
);

export const PlayIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 3.5v9l7.5-4.5z" fill="currentColor" />
  </Icon>
);

export const StopIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="4.5" y="4.5" width="7" height="7" rx="1" fill="currentColor" />
  </Icon>
);

export const AlertIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 2.25L14.25 13.25H1.75z" />
    <path d="M8 6.5v3M8 11.5v.01" />
  </Icon>
);

export const ArrowUpIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 13V3.5M4.5 7L8 3.5 11.5 7" />
  </Icon>
);

export const ArrowDownIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 3v9.5M4.5 9L8 12.5 11.5 9" />
  </Icon>
);

export const TrashIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.5 4.5h11M6.5 4.5V3h3v1.5M4 4.5l.6 8.25a1 1 0 001 .75h4.8a1 1 0 001-.75L12 4.5" />
  </Icon>
);

/** An indeterminate spinner: a quarter arc on a faint track. */
export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className={`animate-spin ${className ?? ''}`}>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.75" />
      <path d="M8 2.5a5.5 5.5 0 015.5 5.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The product mark: a gauge ring with a three-quarter accent sweep over a dark rounded square.
 * Same geometry and colours as the toolbar icon (scripts/gen-icons.mjs) and the website mark,
 * and fixed colours on purpose so the brand looks identical in both themes and in exports.
 */
export function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect width="20" height="20" rx="4.4" fill="#0d1117" />
      <circle cx="10" cy="10" r="6" stroke="#2a313c" strokeWidth="2.2" />
      <circle
        cx="10"
        cy="10"
        r="6"
        stroke="#3d8bff"
        strokeWidth="2.2"
        pathLength={4}
        strokeDasharray="3 4"
        transform="rotate(-90 10 10)"
      />
      <circle cx="10" cy="10" r="1.5" fill="#3d8bff" />
    </svg>
  );
}
