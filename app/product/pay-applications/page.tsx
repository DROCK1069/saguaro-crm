import type { Metadata } from 'next';
import ProductPage from '@/components/ProductPage';

export const metadata: Metadata = {
  title: 'AIA Pay Applications G702/G703 — Generated in 60 Seconds | Saguaro',
  description: 'Generate AIA G702/G703 Applications for Payment and continuation sheets automatically. Track schedule of values, retainage, and stored materials, and submit to owners digitally — no PDFs to fill by hand.',
  alternates: { canonical: 'https://saguarocontrol.net/product/pay-applications' },
};

export default function Page() {
  return (
    <ProductPage data={{
      eyebrow: 'AIA Pay Applications',
      title: <>G702 &amp; G703<br />pay apps, done<br />in 60 seconds.</>,
      subhead: 'Generate AIA Applications for Payment and continuation sheets straight from your schedule of values. Retainage, stored materials, and prior payments calculate themselves — submit to the owner digitally with one click.',
      stats: [
        { value: '60s', label: 'Per pay application' },
        { value: 'G702/703', label: 'AIA-format output' },
        { value: '$0', label: 'Per-document fees' },
      ],
      sections: [
        {
          title: 'Built off your schedule of values',
          body: 'Enter the SOV once. Each month, set percent-complete or this-period amounts per line and Saguaro builds the G703 continuation sheet and rolls totals up to the G702 — no spreadsheets, no re-keying.',
          bullets: ['Schedule of values by line item', 'Percent-complete or dollar entry', 'Stored materials tracked separately', 'Continuation sheet auto-generated'],
        },
        {
          title: 'Retainage and math that never slips',
          body: 'Retainage, completed-to-date, previous applications, and current due all calculate automatically and tie out every month. The numbers reconcile so applications don’t get kicked back.',
          bullets: ['Automatic retainage (flat or by line)', 'Previous vs. current period tracking', 'Balance-to-finish always correct', 'Change orders fold into the SOV'],
        },
        {
          title: 'Submit and get paid faster',
          body: 'Produce a clean AIA-format PDF, attach lien waivers and certified payroll, and send it to the owner or GC digitally. Track approval status so nothing stalls in someone’s inbox.',
          bullets: ['AIA-format PDF export', 'Attach waivers & certified payroll', 'Digital submission & status tracking', 'Owner / GC approval workflow'],
        },
      ],
      steps: [
        { title: 'Set the SOV', body: 'Enter your schedule of values once when the job starts.' },
        { title: 'Update progress', body: 'Each period, enter percent-complete or amounts per line.' },
        { title: 'Generate G702/G703', body: 'Saguaro builds the application and continuation sheet with retainage.' },
        { title: 'Submit', body: 'Send the AIA PDF with waivers attached and track approval.' },
      ],
      closingLine: 'Stop filling pay apps by hand.',
    }} />
  );
}
