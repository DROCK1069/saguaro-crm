import type { Metadata } from 'next';
import ProductPage from '@/components/ProductPage';

export const metadata: Metadata = {
  title: 'Punch Lists & Inspections — Pin It, Assign It, Close It | Saguaro',
  description: 'Build punch lists with photos and locations, assign items to subs, and track them to done — from the field. Run inspections against checklists and capture pass/fail with proof. Faster closeout, fewer callbacks.',
  alternates: { canonical: 'https://saguarocontrol.net/product/punch-lists' },
};

export default function Page() {
  return (
    <ProductPage data={{
      eyebrow: 'Punch Lists & Inspections',
      title: <>Punch it out<br />faster, with<br />fewer callbacks.</>,
      subhead: 'Build punch items with photos and locations, assign them to the right sub, and track every one to done — right from the phone. Run inspections against checklists with pass/fail proof. Closeout gets faster and callbacks get rarer.',
      stats: [
        { value: 'Field', label: 'Created on site' },
        { value: 'Assigned', label: 'To the right sub' },
        { value: 'Proof', label: 'Photo before & after' },
      ],
      sections: [
        {
          title: 'Punch lists that actually get closed',
          body: 'Walk the space, capture each item with a photo and location, and assign it to the responsible sub with a due date. Subs see their items, fix them, and you verify with a before/after — no more spreadsheets and finger-pointing.',
          bullets: ['Photo + location per item', 'Assigned to the responsible sub', 'Due dates & status tracking', 'Before/after verification'],
        },
        {
          title: 'Inspections with a paper trail',
          body: 'Run inspections against reusable checklists, mark pass/fail/N-A, attach photos, and produce a signed report. Quality and safety walks become documented events, not memories.',
          bullets: ['Reusable inspection checklists', 'Pass / fail / N-A with photos', 'Signed inspection reports', 'Quality & safety templates'],
        },
        {
          title: 'A faster, cleaner closeout',
          body: 'With punch and inspections tracked to done, final acceptance and closeout move quickly — and the documented record means fewer warranty callbacks and disputes down the line.',
          bullets: ['Live punch completion status', 'Closeout-ready records', 'Fewer warranty callbacks', 'Owner-visible if you choose'],
        },
      ],
      closingLine: 'Get to final acceptance faster.',
    }} />
  );
}
