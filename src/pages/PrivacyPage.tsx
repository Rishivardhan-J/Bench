import React from 'react';
import { Page, PageHeader } from '@/components/layout/Page';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="mb-32">
    <h2 className="text-body font-semibold text-text mb-8">{title}</h2>
    <div className="text-body text-text-dim flex flex-col gap-12 max-w-prose">{children}</div>
  </section>
);

export const PrivacyPage: React.FC = () => (
  <Page title="Privacy policy" width="narrow">
    <PageHeader title="Privacy policy" description="Last updated November 2026" />
    <p role="note" className="mb-32 p-12 rounded-md border border-border-strong bg-surface-2 text-meta text-text-dim max-w-prose">
      This is a working draft and needs legal review before launch.
    </p>
    <Section title="What we collect">
      <p>Account details (email, name, role), the profile you build, messages you send on Bench, shortlists and notes, and basic usage such as profile views.</p>
      <p>Resumes you upload are private. We read them only to suggest profile fields, and you confirm every suggestion.</p>
    </Section>
    <Section title="How we use it">
      <p>To run the marketplace: show approved profiles in search, deliver messages and notifications, keep the service safe, and send emails you have not turned off.</p>
      <p>We use automated tools to help interpret search briefs and summarise reviews. Your messages are never used for that.</p>
    </Section>
    <Section title="Who sees it">
      <p>Approved profiles are public. Messages are visible only to the people in the conversation. Shortlist notes are visible only to you. Bench administrators can review profiles and reports.</p>
    </Section>
    <Section title="Your choices">
      <p>You can edit or pause your profile at any time and delete your account from Settings. Deleting removes your profile, messages, shortlists and files.</p>
    </Section>
  </Page>
);
