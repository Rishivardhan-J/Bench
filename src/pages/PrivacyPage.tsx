import React from 'react';

export const PrivacyPage: React.FC = () => {
  return (
    <div className="max-w-[800px] mx-auto px-24 pt-64 pb-128">
      {/* TODO: This is a developer draft for the MVP and must receive formal legal review before a true commercial public launch. */}
      <h1 className="text-section-heading text-text mb-32">Privacy Policy</h1>
      
      <div className="flex flex-col gap-24 text-body text-text-dim">
        <p>
          Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>

        <section className="flex flex-col gap-12">
          <h2 className="text-[18px] font-semibold text-text mt-16">1. Information We Collect</h2>
          <p>
            When you create an account, we collect your email address and password for authentication purposes, provided securely via Firebase Authentication.
          </p>
        </section>

        <section className="flex flex-col gap-12">
          <h2 className="text-[18px] font-semibold text-text mt-16">2. How We Use AI (Google Gemini)</h2>
          <p>
            Bench uses Google's Gemini AI to parse the project briefs you submit to generate filters and reasoning. <strong>The text you enter into the "Project brief" field is sent server-side to the Gemini API.</strong> Please do not include sensitive, confidential, or personally identifiable information in your project briefs.
          </p>
        </section>

        <section className="flex flex-col gap-12">
          <h2 className="text-[18px] font-semibold text-text mt-16">3. Data Storage and Shortlists</h2>
          <p>
            If you create an account, your generated shortlists (saved freelancer IDs) are stored in our secure database (Google Firestore) associated with your user ID. We use this data solely to provide the shortlist feature to you.
          </p>
        </section>

        <section className="flex flex-col gap-12">
          <h2 className="text-[18px] font-semibold text-text mt-16">4. Freelancer Data</h2>
          <p>
            Currently, Bench operates using synthetic <strong>demo data</strong> for demonstration purposes. We do not scrape, store, or share real third-party freelancer profiles. This section will be updated when real API integrations are established.
          </p>
        </section>

        <section className="flex flex-col gap-12">
          <h2 className="text-[18px] font-semibold text-text mt-16">5. Contact</h2>
          <p>
            For any privacy-related inquiries, please contact us at privacy@bench.example.com.
          </p>
        </section>
      </div>
    </div>
  );
};
