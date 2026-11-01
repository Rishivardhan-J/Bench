import React from 'react';

/** Sets the document title for the current route. */
export function usePageTitle(title: string | undefined) {
  React.useEffect(() => {
    if (!title) return;
    const prev = document.title;
    document.title = `${title} · Bench`;
    return () => {
      document.title = prev;
    };
  }, [title]);
}

interface PageProps {
  title?: string;
  width?: 'page' | 'narrow' | 'form' | 'auth' | 'shell';
  children: React.ReactNode;
  className?: string;
}

const widths = { page: 'max-w-page', narrow: 'max-w-narrow', form: 'max-w-form', auth: 'max-w-auth', shell: 'max-w-shell' };

export const Page: React.FC<PageProps> = ({ title, width = 'page', children, className = '' }) => {
  usePageTitle(title);
  return <div className={`mx-auto w-full px-16 sm:px-24 py-32 sm:py-48 ${widths[width]} ${className}`}>{children}</div>;
};

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-16 mb-32">
    <div>
      <h1 className="text-page-heading text-text">{title}</h1>
      {description && <p className="text-body text-text-dim mt-8 max-w-prose">{description}</p>}
    </div>
    {actions && <div className="flex items-center gap-12">{actions}</div>}
  </div>
);

/** Updates the description and Open Graph tags for the current route (restored on leave). */
export function usePageMeta(meta: { title?: string; description?: string } | null) {
  React.useEffect(() => {
    if (!meta) return;
    const set = (selector: string, attr: string, key: string, value: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      const created = !el;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      const prev = el.getAttribute('content');
      el.setAttribute('content', value);
      return () => {
        if (created) el?.remove();
        else if (prev !== null) el?.setAttribute('content', prev);
      };
    };
    const undo: (() => void)[] = [];
    if (meta.description) {
      undo.push(set('meta[name="description"]', 'name', 'description', meta.description));
      undo.push(set('meta[property="og:description"]', 'property', 'og:description', meta.description));
    }
    if (meta.title) undo.push(set('meta[property="og:title"]', 'property', 'og:title', meta.title));
    return () => undo.forEach((fn) => fn());
  }, [meta?.title, meta?.description]); // eslint-disable-line react-hooks/exhaustive-deps
}
