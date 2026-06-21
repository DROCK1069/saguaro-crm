import type { Metadata } from 'next';
import ProductPage from '@/components/ProductPage';

export const metadata: Metadata = {
  title: 'Financials & Reporting — Budgets, Invoicing, Job Costing | Saguaro',
  description: 'Budgets vs. actuals, job costing, invoicing, and portfolio reporting in one place. See margin in real time, invoice from the schedule of values, and sync to QuickBooks — no spreadsheet gymnastics.',
  alternates: { canonical: 'https://saguarocontrol.net/product/financials' },
};

export default function Page() {
  return (
    <ProductPage data={{
      eyebrow: 'Financials & Reporting',
      title: <>Know your margin<br />in real time,<br />job by job.</>,
      subhead: 'Budgets vs. actuals, job costing, invoicing, and portfolio reporting in one place. Watch margin move as costs land, invoice straight from your schedule of values, and sync to QuickBooks — without the spreadsheet gymnastics.',
      stats: [
        { value: 'Real-time', label: 'Budget vs. actual' },
        { value: 'QuickBooks', label: 'Two-way sync' },
        { value: '1 click', label: 'Invoices from the SOV' },
      ],
      sections: [
        {
          title: 'Budgets vs. actuals that stay current',
          body: 'Costs from pay apps, invoices, and change orders post against the budget automatically, so committed and actual costs — and the margin left — are always live. Catch an overrun while you can still do something about it.',
          bullets: ['Live committed vs. actual costs', 'Margin by job and portfolio', 'Change orders update the budget', 'Cost codes & job costing'],
        },
        {
          title: 'Invoice without re-keying',
          body: 'Generate invoices straight from the schedule of values or completed work, apply retainage, and send. No copying numbers between your PM tool and your accounting software.',
          bullets: ['Invoice from the SOV', 'Retainage handled automatically', 'Progress & final billing', 'Branded invoice PDFs'],
        },
        {
          title: 'Reporting the office and the bank both want',
          body: 'Run WIP, cash flow, AR aging, and portfolio rollups on demand. Sync to QuickBooks or Sage so your books match your projects without double entry.',
          bullets: ['WIP & cash-flow reports', 'AR aging & portfolio rollups', 'QuickBooks / Sage sync', 'Export to Excel / PDF'],
        },
      ],
      closingLine: 'Stop running your margins on a spreadsheet.',
    }} />
  );
}
