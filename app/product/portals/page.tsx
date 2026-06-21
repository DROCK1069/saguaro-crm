import type { Metadata } from 'next';
import ProductPage from '@/components/ProductPage';

export const metadata: Metadata = {
  title: 'Owner & Subcontractor Portals — Branded Client Access | Saguaro',
  description: 'Give owners a branded portal to approve changes, view progress, and pay — and subs a portal for bids, W-9s, insurance, and pay apps. White-label it as your own and cut the email back-and-forth.',
  alternates: { canonical: 'https://saguarocontrol.net/product/portals' },
};

export default function Page() {
  return (
    <ProductPage data={{
      eyebrow: 'Owner & Sub Portals',
      title: <>Your clients and<br />subs, in one<br />branded portal.</>,
      subhead: 'Give owners a branded place to see progress, approve changes, and pay — and subcontractors a portal for bids, W-9s, insurance, and pay applications. White-label it as your own brand and end the endless email chains.',
      stats: [
        { value: '2', label: 'Owner + Sub portals' },
        { value: 'White-label', label: 'Your brand, your domain' },
        { value: '↓', label: 'Less email back-and-forth' },
      ],
      sections: [
        {
          title: 'A professional owner experience',
          body: 'Owners log into a branded portal to follow progress, review and approve change orders, see selections, and make payments — the same polished client experience the big builders sell, under your name.',
          bullets: ['Progress & schedule visibility', 'Change-order approvals', 'Selections & document sign-off', 'Online payments'],
        },
        {
          title: 'Subs that stay compliant on their own',
          body: 'Subcontractors submit bids, upload W-9s and certificates of insurance, sign lien waivers, and view their pay applications — so your compliance gaps close without you chasing anyone.',
          bullets: ['Bid submission & invitations', 'W-9 and COI collection', 'Lien waiver e-signing', 'Pay-app visibility for subs'],
        },
        {
          title: 'White-label it as your brand',
          body: 'Put your logo, colors, and domain on the whole experience. To your clients and subs it looks like your company built the software — not a tool you bolted on.',
          bullets: ['Your logo & color theme', 'Custom domain', 'Branded emails & documents', 'No “powered by” clutter'],
        },
      ],
      steps: [
        { title: 'Invite them', body: 'Send owners and subs a branded invite to their portal.' },
        { title: 'They self-serve', body: 'Owners approve & pay; subs upload compliance docs and bids.' },
        { title: 'You stay clean', body: 'Approvals, waivers, and COIs collect themselves — no chasing.' },
        { title: 'Everyone’s in sync', body: 'It all ties back to the project in your dashboard automatically.' },
      ],
      closingLine: 'Look like the biggest builder in town.',
    }} />
  );
}
