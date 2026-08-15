import React from 'react';

export const TermsPage: React.FC = () => {
  return (
    <div className="max-w-[800px] mx-auto px-24 pt-64 pb-128">
      {/* TODO: This is a developer draft for the MVP and must receive formal legal review before a true commercial public launch. */}
      <h1 className="text-section-heading text-text mb-32">Terms of Service</h1>
      
      <div className="flex flex-col gap-24 text-body text-text-dim">
        <p>
          Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>

        <section className="flex flex-col gap-12">
          <h2 className="text-[18px] font-semibold text-text mt-16">1. Acceptance of Terms</h2>
          <p>
            By accessing or using Bench, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the service.
          </p>
        </section>

        <section className="flex flex-col gap-12">
          <h2 className="text-[18px] font-semibold text-text mt-16">2. Description of Service</h2>
          <p>
            Bench is an AI-assisted search tool designed to help users filter and shortlist freelancer profiles. Currently, the platform operates on synthetic demo data. <strong>Bench does not facilitate payments, contracting, or messaging between users.</strong> All freelancer engagements must be handled off-platform.
          </p>
        </section>

        <section className="flex flex-col gap-12">
          <h2 className="text-[18px] font-semibold text-text mt-16">3. User Accounts</h2>
          <p>
            You are responsible for safeguarding the password that you use to access the service and for any activities or actions under your password.
          </p>
        </section>

        <section className="flex flex-col gap-12">
          <h2 className="text-[18px] font-semibold text-text mt-16">4. Prohibited Uses</h2>
          <p>
            You agree not to use the service to submit briefs that contain illegal, offensive, or maliciously crafted content designed to exploit or attack our AI services. We reserve the right to rate-limit or terminate access for accounts that abuse the platform.
          </p>
        </section>
      </div>
    </div>
  );
};
