import { Children, type ReactNode } from 'react';

/**
 * A wrapping line of facts with a dot between them. Each fact carries its dot in its own left gutter,
 * and the list is shifted left by one gutter and clipped, so a fact that starts a line never shows a
 * dot and no line ends with one.
 */
export function Facts({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden ${className}`}>
      <p className="-ml-4 flex flex-wrap items-center gap-y-1 text-[13px] text-muted">
        {Children.toArray(children).map((child, index) => (
          <span key={index} className="relative flex items-center pl-4 before:absolute before:left-[6px] before:text-faint before:content-['·']">
            {child}
          </span>
        ))}
      </p>
    </div>
  );
}
