import type { Metadata } from 'next';
import ProductPage from '@/components/ProductPage';

export const metadata: Metadata = {
  title: 'RFIs & Change Orders — Tracked, Routed, Never Dropped | Saguaro',
  description: 'Create, route, and track RFIs and change orders with deadlines, ball-in-court, and a full audit trail. Sage can even draft RFIs and change-order language for you. Nothing falls through the cracks.',
  alternates: { canonical: 'https://saguarocontrol.net/product/rfis' },
};

export default function Page() {
  return (
    <ProductPage data={{
      eyebrow: 'RFIs & Change Orders',
      title: <>RFIs and COs<br />that never fall<br />through the cracks.</>,
      subhead: 'Create, route, and track every RFI and change order with deadlines, ball-in-court, and a complete audit trail. Sage drafts the language; Saguaro makes sure it gets answered and priced. Nothing gets lost.',
      stats: [
        { value: 'Tracked', label: 'Deadlines & ball-in-court' },
        { value: 'AI-drafted', label: 'RFI & CO language' },
        { value: 'Audit', label: 'Full paper trail' },
      ],
      sections: [
        {
          title: 'RFIs that get answered',
          body: 'Log an RFI from the office or the field, route it to the right party, set a due date, and track ball-in-court. Overdue items surface automatically so a slow answer doesn’t become a delay claim.',
          bullets: ['Field or office creation', 'Routing & ball-in-court', 'Due dates & overdue alerts', 'Attach drawings & photos'],
        },
        {
          title: 'Change orders that protect your margin',
          body: 'Turn an RFI answer or field condition into a priced change order, route it for approval, and roll the approved amount into the budget and the schedule of values automatically.',
          bullets: ['RFI → change order in a click', 'Pricing & markup built in', 'Approval workflow', 'Flows into budget & pay apps'],
        },
        {
          title: 'A trail that holds up',
          body: 'Every RFI and CO keeps a timestamped history of who said what and when, with all attachments — so disputes are settled by the record, not by memory.',
          bullets: ['Timestamped history', 'Linked correspondence', 'Searchable per project', 'Export for claims & closeout'],
        },
      ],
      closingLine: 'Make slow answers someone else’s problem.',
    }} />
  );
}
