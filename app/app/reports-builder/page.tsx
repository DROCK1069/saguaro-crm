/**
 * /app/reports-builder — retired duplicate of the custom report builder.
 *
 * The canonical builder lives at /app/reports/builder (the page the Reports
 * hub links to): it runs REAL tenant data through /api/reports/run and
 * exports through /api/reports/export. This old page previewed reports with
 * generated sample data, so it was retired in favor of a permanent redirect —
 * every legacy link (including old scheduled-report emails) lands on the real
 * builder.
 */
import { redirect } from 'next/navigation';

export default function ReportsBuilderRedirect() {
  redirect('/app/reports/builder');
}
