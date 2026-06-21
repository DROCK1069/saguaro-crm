import type { Metadata } from 'next';
import ProductPage from '@/components/ProductPage';

export const metadata: Metadata = {
  title: 'Daily Logs & Field Reporting — Weather, Crew, Photos | Saguaro',
  description: 'Capture daily logs with weather, crew counts, work performed, delays, and photos from the job site — online or offline. Auto-stamped, searchable, and ready to defend a delay claim.',
  alternates: { canonical: 'https://saguarocontrol.net/product/daily-logs' },
};

export default function Page() {
  return (
    <ProductPage data={{
      eyebrow: 'Daily Logs & Field Reporting',
      title: <>Document the day<br />in two minutes,<br />from the site.</>,
      subhead: 'Weather, crew counts, work performed, delays, deliveries, and photos — captured on the phone before the crew leaves. Auto-stamped and searchable, so the record is there when a delay claim or dispute shows up months later.',
      stats: [
        { value: '2 min', label: 'To log the day' },
        { value: 'Auto', label: 'Weather & timestamps' },
        { value: 'Offline', label: 'Captured anywhere' },
      ],
      sections: [
        {
          title: 'Everything that matters, captured fast',
          body: 'Crew and headcount, work performed by area, deliveries, equipment, delays, and safety — entered with taps, not paragraphs. Weather pulls in automatically for the date and location.',
          bullets: ['Crew counts & work performed', 'Auto weather by date & location', 'Deliveries, equipment, delays', 'Safety notes & incidents'],
        },
        {
          title: 'Photos that prove it',
          body: 'Snap progress photos that auto-tag to the project, date, and location. They land in a searchable gallery the office can see in real time — no texting photos to the PM anymore.',
          bullets: ['Auto-tagged progress photos', 'Searchable project gallery', 'Visible to the office instantly', 'Captured offline, synced later'],
        },
        {
          title: 'A defensible record',
          body: 'Every log is timestamped and locked to its date. When a delay claim or backcharge comes up, you have a clean, contemporaneous record instead of trying to reconstruct what happened.',
          bullets: ['Contemporaneous & timestamped', 'Searchable across the project', 'Export logs for claims', 'Owner-visible if you choose'],
        },
      ],
      closingLine: 'Win the delay claim before it starts.',
    }} />
  );
}
