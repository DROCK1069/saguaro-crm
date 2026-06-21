import type { Metadata } from 'next';
import ProductPage from '@/components/ProductPage';

export const metadata: Metadata = {
  title: 'Saguaro Field — Native iOS App for the Job Site | Saguaro',
  description: 'Daily logs, photos, GPS clock-in, punch lists, RFIs, and inspections from the job site. Saguaro Field is a free native iOS app that works fully offline and syncs the moment you reconnect.',
  alternates: { canonical: 'https://saguarocontrol.net/product/field-app' },
};

export default function Page() {
  return (
    <ProductPage data={{
      eyebrow: 'Saguaro Field — iOS App',
      title: <>The job site,<br />in your pocket.<br />Even offline.</>,
      subhead: 'Daily logs, photos, GPS clock-in, punch lists, RFIs, and inspections — captured on an iPhone or iPad with gloves on. Saguaro Field is a free native iOS app that works fully offline and syncs the second you get signal.',
      stats: [
        { value: 'iOS', label: 'Native iPhone & iPad' },
        { value: '100%', label: 'Offline-capable' },
        { value: 'Free', label: 'For your whole crew' },
      ],
      sections: [
        {
          title: 'Built for the field, not the office',
          body: 'Big touch targets, fast capture, and a layout your crew understands in minutes. Log the day, snap photos, clock in with GPS, and move on — no training class required.',
          bullets: ['Daily logs with weather & crew counts', 'Photos auto-tagged to the project', 'GPS-stamped clock in / out', 'Punch lists & inspections on site'],
        },
        {
          title: 'Works without signal',
          body: 'Basements, remote sites, dead zones — it all keeps working. Everything you capture is stored on the device and syncs automatically the moment you’re back online. Nothing is lost.',
          bullets: ['Full offline capture', 'Automatic background sync', 'Conflict-safe queue', 'Never lose a log or photo'],
        },
        {
          title: 'The office sees it in real time',
          body: 'The second a log, photo, or RFI syncs, it shows up in the web dashboard tied to the right project — so the office and the crew are never working off different information.',
          bullets: ['Instant sync to the dashboard', 'RFIs & submittals from the field', 'Sage AI assistant on the phone', 'Push notifications for what matters'],
        },
      ],
      steps: [
        { title: 'Download it free', body: 'Get Saguaro Field from the App Store on every crew member’s iPhone or iPad.' },
        { title: 'Capture on site', body: 'Log the day, take photos, clock in with GPS, file RFIs — online or off.' },
        { title: 'It syncs itself', body: 'Everything uploads automatically when signal returns. No manual exports.' },
        { title: 'Office stays in sync', body: 'The web dashboard reflects field activity in real time.' },
      ],
      closingLine: 'Give your crew the field app for free.',
    }} />
  );
}
