import type { Metadata } from 'next';
import ProductPage from '@/components/ProductPage';

export const metadata: Metadata = {
  title: 'Sage AI Assistant — Your Built-In Construction Expert | Saguaro',
  description: 'Ask Sage anything about your projects — budgets, schedules, RFIs, compliance, lien law, AIA contracts. It knows your data and answers instantly, from the office or the job site.',
  alternates: { canonical: 'https://saguarocontrol.net/product/sage-ai' },
};

export default function Page() {
  return (
    <ProductPage data={{
      eyebrow: 'Sage AI Assistant',
      title: <>An expert who<br />knows every job<br />you’re running.</>,
      subhead: 'Sage is a construction expert built into Saguaro. Ask it anything — your budgets, schedules, RFIs, lien deadlines, AIA contract questions — and it answers instantly using your real project data, from the office or the field.',
      stats: [
        { value: 'Built-in', label: 'Every screen & the app' },
        { value: 'Your data', label: 'Knows your projects' },
        { value: '24/7', label: 'Instant answers' },
      ],
      sections: [
        {
          title: 'It knows your projects, not just the internet',
          body: 'Sage is grounded in your actual data — contract values, schedules, open RFIs, budgets, compliance status. Ask “which jobs are over budget?” or “what RFIs are overdue?” and get a real answer, not a generic one.',
          bullets: ['Answers from your live project data', 'Budgets, schedules, RFIs, compliance', 'Cross-project portfolio questions', 'Cites the items behind the answer'],
        },
        {
          title: 'A construction expert on call',
          body: 'Lien deadlines, AIA pay-app rules, change-order strategy, OSHA, certified payroll — Sage answers the domain questions that usually mean a call to your PM, attorney, or a Google rabbit hole.',
          bullets: ['Lien law & deadlines by state', 'AIA contract & pay-app guidance', 'Bidding & margin strategy', 'OSHA & safety questions'],
        },
        {
          title: 'In the field, too',
          body: 'Sage rides in the Saguaro Field iOS app, so a foreman can ask a question or draft an RFI from the job site without calling the office.',
          bullets: ['Available in the field app', 'Draft RFIs & logs hands-free', 'Quick spec & code lookups', 'Same expert, on the phone'],
        },
      ],
      closingLine: 'Put an expert in every pocket.',
    }} />
  );
}
