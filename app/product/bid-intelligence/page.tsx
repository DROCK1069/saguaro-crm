import type { Metadata } from 'next';
import ProductPage from '@/components/ProductPage';

export const metadata: Metadata = {
  title: 'Bid Intelligence — AI Scores Every Bid 0–100 | Saguaro',
  description: 'Stop chasing bad bids. Saguaro’s Bid Intelligence scores every opportunity 0–100 based on your win history, margin targets, and project fit — and recommends a margin so you bid the work you can actually win.',
  alternates: { canonical: 'https://saguarocontrol.net/product/bid-intelligence' },
};

export default function Page() {
  return (
    <ProductPage data={{
      eyebrow: 'Bid Intelligence',
      title: <>Bid the work<br />you can<br />actually win.</>,
      subhead: 'Saguaro scores every bid opportunity 0–100 against your win history, margin targets, and project fit — then recommends a margin. Stop burning estimating hours on jobs you were never going to land.',
      stats: [
        { value: '0–100', label: 'Score on every bid' },
        { value: 'AI', label: 'Margin recommendation' },
        { value: '↑', label: 'Win rate over time' },
      ],
      sections: [
        {
          title: 'A win-probability score before you commit',
          body: 'Each opportunity gets a score based on the factors that actually drive your wins — project type, size, owner, location, and how you’ve fared on similar work. Triage your pipeline in seconds instead of guessing.',
          bullets: ['0–100 fit & win-probability score', 'Learns from your real bid history', 'Flags long-shot and slam-dunk bids', 'Reasoning shown for every score'],
        },
        {
          title: 'A margin you can defend',
          body: 'Saguaro suggests a target margin for each bid given the competition and your historical results — so you’re not leaving money on the table on safe jobs or pricing yourself out of winnable ones.',
          bullets: ['Recommended margin per opportunity', 'Tuned to your win/loss record', 'Adjust and see the trade-off', 'Feeds straight into your estimate'],
        },
        {
          title: 'Sharpen your pipeline every quarter',
          body: 'As you log wins and losses, the model sharpens. Over time you spend estimating hours where they pay off and watch your hit-rate climb instead of staying flat.',
          bullets: ['Win-rate trend over time', 'Pipeline prioritized by score', 'Post-bid win/loss capture', 'Less time on dead-end bids'],
        },
      ],
      steps: [
        { title: 'Log the opportunity', body: 'Add the bid — project type, owner, size, location.' },
        { title: 'Get a score', body: 'Sage scores fit and win probability 0–100 with reasoning.' },
        { title: 'Set the margin', body: 'Use the AI-recommended margin or adjust to your strategy.' },
        { title: 'Track the outcome', body: 'Log the win or loss; the model gets sharper next quarter.' },
      ],
      closingLine: 'Stop chasing bids you can’t win.',
    }} />
  );
}
