import type { Metadata } from 'next';
import ProductPage from '@/components/ProductPage';

export const metadata: Metadata = {
  title: 'Submittals & Compliance — Logs, Routing, COIs & Closeout | Saguaro',
  description: 'Track submittals through review with a full log and ball-in-court, collect subcontractor insurance and W-9s, and assemble a complete closeout package. Compliance gaps close themselves.',
  alternates: { canonical: 'https://saguarocontrol.net/product/submittals' },
};

export default function Page() {
  return (
    <ProductPage data={{
      eyebrow: 'Submittals & Compliance',
      title: <>Submittals and<br />compliance, on<br />autopilot.</>,
      subhead: 'Run submittals through review with a clean log and ball-in-court, keep subcontractor insurance and W-9s current, and assemble a complete closeout package — so the compliance gaps that cause real problems close on their own.',
      stats: [
        { value: 'Logged', label: 'Submittal review cycle' },
        { value: 'COI', label: 'Insurance tracking' },
        { value: 'Closeout', label: 'Package, assembled' },
      ],
      sections: [
        {
          title: 'A submittal log that stays current',
          body: 'Track every submittal through submitted, under review, approved-as-noted, and revise-and-resubmit, with due dates and ball-in-court — so the schedule isn’t hostage to a spec section sitting on a desk.',
          bullets: ['Full submittal register', 'Review status & ball-in-court', 'Due dates & overdue alerts', 'Spec-section linked'],
        },
        {
          title: 'Insurance & W-9s that never lapse',
          body: 'Collect and parse certificates of insurance and W-9s from subs, flag expirations before they bite, and block work for subs that are out of compliance — automatically.',
          bullets: ['COI collection & parsing', 'Expiration alerts', 'W-9 tracking', 'Compliance status per sub'],
        },
        {
          title: 'Closeout without the fire drill',
          body: 'O&M manuals, warranties, as-builts, final waivers, and certified payroll assemble into a closeout package as the job runs — so final payment isn’t held up by a month of document hunting.',
          bullets: ['O&M & warranty collection', 'As-builts & final waivers', 'Assembled closeout package', 'Ready before final payment'],
        },
      ],
      closingLine: 'Close out clean, every time.',
    }} />
  );
}
