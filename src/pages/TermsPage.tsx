import React from 'react';
import { Page, PageHeader } from '@/components/layout/Page';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="mb-32">
    <h2 className="text-body font-semibold text-text mb-8">{title}</h2>
    <div className="text-body text-text-dim flex flex-col gap-12 max-w-prose">{children}</div>
  </section>
);

export const TermsPage: React.FC = () => (
  <Page title="Terms of service" width="narrow">
    <PageHeader title="Terms of service" description="Last updated November 2026" />
    <p role="note" className="mb-32 p-12 rounded-md border border-border-strong bg-surface-2 text-meta text-text-dim max-w-prose">
      This is a working draft and needs legal review before launch.
    </p>
    <Section title="Using Bench">
      <p>Bench helps clients find and contact freelancers. We are not a party to any agreement between you and another user, and we do not process payments.</p>
    </Section>
    <Section title="Your account">
      <p>Keep your credentials safe and provide accurate information. A client account and a freelancer account cannot share an email address.</p>
    </Section>
    <Section title="Acceptable use">
      <p>Do not harass others, post misleading profiles or reviews, send spam, or try to move people off Bench in a deceptive way. We may remove content or suspend accounts that break these rules.</p>
    </Section>
    <Section title="Reviews">
      <p>Only clients who marked a hire can leave a review, and each engagement can be reviewed once. Freelancers can reply once.</p>
    </Section>
    <Section title="Changes">
      <p>We may update these terms. If the changes are significant we will tell you in the app.</p>
    </Section>
  </Page>
);
