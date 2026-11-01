import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { activePath } from './navigation';
import type { NavItem } from './navigation';

interface NavItemsProps {
  items: NavItem[];
  unreadMessages: number;
  onPrefetch: (path: string) => void;
  /** Height class shared by the links and the sliding highlight so they always line up. */
  heightClass: 'h-32' | 'h-40';
  /** Scroll the active item to the middle of its scrolling parent (the phone layout). */
  centerActive?: boolean;
}

/**
 * Navigation links with one highlight that slides to the active item.
 * Used by both the desktop bar and the phone row so behaviour lives in one place.
 */
export const NavItems: React.FC<NavItemsProps> = ({ items, unreadMessages, onPrefetch, heightClass, centerActive }) => {
  const { pathname } = useLocation();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [pill, setPill] = React.useState<{ x: number; w: number } | null>(null);
  const [animate, setAnimate] = React.useState(false);
  const active = activePath(items, pathname);

  const measure = React.useCallback(() => {
    const el = active ? containerRef.current?.querySelector<HTMLElement>(`[data-nav="${CSS.escape(active)}"]`) : null;
    setPill(el ? { x: el.offsetLeft, w: el.offsetWidth } : null);
    return el;
  }, [active]);

  React.useLayoutEffect(() => {
    const el = measure();
    if (centerActive && el) {
      const scroller = containerRef.current?.parentElement;
      scroller?.scrollTo({ left: el.offsetLeft - (scroller.clientWidth - el.offsetWidth) / 2, behavior: animate ? 'smooth' : 'auto' });
    }
    // Turn the slide on only after the first placement, so the highlight does not fly in from the left on load.
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, [measure, centerActive, items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fonts and the unread dot can change widths after first paint.
  React.useEffect(() => {
    if (!containerRef.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div ref={containerRef} className="relative flex items-center gap-4">
      {pill && (
        <span
          aria-hidden="true"
          className={`absolute top-0 left-0 ${heightClass} rounded-md bg-surface-3 ${animate ? 'transition-all duration-150' : ''}`}
          style={{ transform: `translateX(${pill.x}px)`, width: pill.w }}
        />
      )}
      {items.map((item) => {
        const isActive = item.to === active;
        return (
          <Link
            key={item.to}
            to={item.to}
            data-nav={item.to}
            aria-current={isActive ? 'page' : undefined}
            onPointerEnter={() => onPrefetch(item.to)}
            onFocus={() => onPrefetch(item.to)}
            onTouchStart={() => onPrefetch(item.to)}
            className={`relative z-10 inline-flex items-center gap-8 ${heightClass} px-12 rounded-md text-body whitespace-nowrap transition-colors duration-120 ${
              isActive ? 'text-text' : 'text-text-dim hover:text-text hover:bg-surface-2'
            }`}
          >
            {item.label}
            {item.label === 'Messages' && unreadMessages > 0 && (
              <>
                <span className="w-8 h-8 rounded-full bg-accent" aria-hidden="true" />
                <span className="sr-only">{unreadMessages} unread</span>
              </>
            )}
          </Link>
        );
      })}
    </div>
  );
};
