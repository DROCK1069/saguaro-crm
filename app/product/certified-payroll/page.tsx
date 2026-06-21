import type { Metadata } from 'next';
import ProductPage from '@/components/ProductPage';

export const metadata: Metadata = {
  title: 'Certified Payroll WH-347 — Davis-Bacon Compliant | Saguaro',
  description: 'Generate DOL-compliant WH-347 certified payroll reports for prevailing-wage and Davis-Bacon projects. Pulls live wage rates, calculates fringe, and submits to agencies — no spreadsheets, no rejections.',
  alternates: { canonical: 'https://saguarocontrol.net/product/certified-payroll' },
};

export default function Page() {
  return (
    <ProductPage data={{
      eyebrow: 'Certified Payroll',
      title: <>WH-347 certified<br />payroll, without<br />the spreadsheet.</>,
      subhead: 'DOL-compliant weekly certified payroll for prevailing-wage and Davis-Bacon jobs. Saguaro pulls live wage determinations, calculates fringe and overtime, and produces a clean WH-347 you can submit without it bouncing back.',
      stats: [
        { value: 'WH-347', label: 'DOL-compliant format' },
        { value: 'Davis-Bacon', label: 'Live wage rates' },
        { value: 'Weekly', label: 'In minutes, not hours' },
      ],
      sections: [
        {
          title: 'Live prevailing-wage rates built in',
          body: 'Pull the correct Davis-Bacon wage determination for the project’s county and classification, so base rates and fringe are right from the start — not guessed off last year’s sheet.',
          bullets: ['County & classification wage lookups', 'Base rate + fringe handled correctly', 'State prevailing-wage support', 'Updates as determinations change'],
        },
        {
          title: 'The math that gets reports rejected — automated',
          body: 'Overtime, fringe, deductions, and gross-to-net all calculate from the hours your crew already logged in the field app. The statement of compliance is filled and ready to certify.',
          bullets: ['OT & fringe auto-calculated', 'Pulls hours from field timesheets', 'Statement of compliance included', 'Deductions and gross-to-net'],
        },
        {
          title: 'Submit with confidence',
          body: 'Produce the WH-347 PDF, attach it to your pay application, and submit to the agency or GC. Keep a clean weekly archive so an audit is a non-event.',
          bullets: ['WH-347 PDF export', 'Attaches to AIA pay apps', 'Weekly archive per project', 'Audit-ready records'],
        },
      ],
      steps: [
        { title: 'Set the project', body: 'Saguaro pulls the Davis-Bacon determination for the county & trades.' },
        { title: 'Hours flow in', body: 'Crew hours come straight from field timesheets — no re-keying.' },
        { title: 'Generate WH-347', body: 'Fringe, OT, and the compliance statement fill automatically.' },
        { title: 'Submit & archive', body: 'Export the PDF, attach to the pay app, and keep an audit-ready record.' },
      ],
      closingLine: 'Make certified payroll a non-event.',
    }} />
  );
}
