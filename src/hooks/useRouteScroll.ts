import React from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { recallScroll, rememberScroll } from '@/lib/scrollMemory';

/**
 * After navigating to a different page: scroll to the top (or restore the saved position on Back/Forward)
 * and move focus to <main> so keyboard and screen-reader users start at the content.
 * URL-only changes on the same page (such as search filters) leave the scroll position alone.
 */
export function useRouteScroll() {
  const { pathname, key } = useLocation();
  const navType = useNavigationType();
  const lastPath = React.useRef(pathname);
  const lastKey = React.useRef(key);
  const first = React.useRef(true);

  React.useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        rememberScroll(lastKey.current, window.scrollY);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  React.useEffect(() => {
    const pageChanged = pathname !== lastPath.current;
    lastPath.current = pathname;
    lastKey.current = key;
    if (first.current) {
      first.current = false;
      return;
    }
    if (navType === 'POP') {
      const target = recallScroll(key);
      if (target !== undefined) {
        // The page may still be loading; retry briefly until it is tall enough to scroll there.
        let tries = 0;
        const attempt = () => {
          window.scrollTo(0, target);
          if (Math.abs(window.scrollY - target) > 2 && tries++ < 30) requestAnimationFrame(attempt);
        };
        requestAnimationFrame(attempt);
        return;
      }
    }
    if (!pageChanged) return;
    window.scrollTo(0, 0);
    document.getElementById('main-content')?.focus({ preventScroll: true });
  }, [pathname, key, navType]);
}
