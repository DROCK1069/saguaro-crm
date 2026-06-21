import type { Metadata } from 'next';
import ProductPage from '@/components/ProductPage';

export const metadata: Metadata = {
  title: 'Lien Waivers — All 50 States, Sent, Signed & Tracked | Saguaro',
  description: 'Conditional and unconditional, partial and final lien waivers with statutory language for all 50 states. Send, e-sign, and track waivers digitally — no paper, no fax, no compliance gaps at closeout.',
  alternates: { canonical: 'https://saguarocontrol.net/product/lien-waivers' },
};

export default function Page() {
  return (
    <ProductPage data={{
      eyebrow: 'Lien Waivers',
      title: <>Lien waivers<br />for all 50 states,<br />sent and signed.</>,
      subhead: 'Conditional and unconditional, partial and final — with the correct statutory language for every state baked in. Send for e-signature, track who’s signed, and close out jobs without chasing paper.',
      stats: [
        { value: '50', label: 'States, statutory language' },
        { value: '4', label: 'Waiver types covered' },
        { value: '0', label: 'Paper, faxes, or chasing' },
      ],
      sections: [
        {
          title: 'The right form, every time',
          body: 'States like California, Texas, and others mandate exact waiver wording. Saguaro picks the statutory form automatically based on the project’s state and the waiver type — so you’re never signing the wrong document.',
          bullets: ['Conditional & unconditional', 'Partial (progress) & final', 'State-specific statutory language', 'Auto-filled with job & amount data'],
        },
        {
          title: 'Send, e-sign, and track',
          body: 'Issue waivers to subs and suppliers for signature, collect them back digitally, and see exactly which waivers are outstanding before you release a payment — no more closeout surprises.',
          bullets: ['One-click send for e-signature', 'Real-time signed / outstanding status', 'Tie waivers to pay applications', 'Full audit trail per project'],
        },
        {
          title: 'Closeout without the scramble',
          body: 'At final payment, every conditional and unconditional waiver is collected, tied to the right draw, and stored — so your closeout package is complete and your lien risk is covered.',
          bullets: ['Waivers linked to each draw', 'Complete closeout package', 'Lien-risk exposure at a glance', 'Searchable waiver archive'],
        },
      ],
      steps: [
        { title: 'Pick the project', body: 'Saguaro reads the state and selects the correct statutory form.' },
        { title: 'Choose type & amount', body: 'Conditional/unconditional, partial/final — auto-filled with job data.' },
        { title: 'Send for signature', body: 'Subs and suppliers e-sign; status updates in real time.' },
        { title: 'Track to closeout', body: 'See outstanding waivers and assemble a complete closeout package.' },
      ],
      closingLine: 'Close out jobs without chasing paper.',
    }} />
  );
}
