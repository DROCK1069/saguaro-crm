import type { Metadata } from 'next';
import ProductPage from '@/components/ProductPage';

export const metadata: Metadata = {
  title: 'AI Blueprint Takeoff — Full Estimate in 60 Seconds | Saguaro',
  description: 'Upload any PDF blueprint and get a complete, CSI-coded material and cost estimate in under 60 seconds. Saguaro’s AI reads dimensions, counts materials, and prices the job — work that takes an estimator half a day.',
  alternates: { canonical: 'https://saguarocontrol.net/product/ai-takeoff' },
};

const TEXT = '#1C1C1E', DIM = '#6E6E73', GOLD = '#C8881C';

const visual = (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 14, borderBottom: `2px solid ${TEXT}` }}>
      <span style={{ fontSize: 14, fontWeight: 800, color: TEXT }}>AI Takeoff Results</span>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: GOLD, fontVariantNumeric: 'tabular-nums' }}>38s · 47 items</span>
    </div>
    {[
      ['Concrete Footing', '124', 'CY', '$18,600'],
      ['#5 Rebar', '2,400', 'LF', '$4,320'],
      ['CMU 8″ Block', '3,650', 'EA', '$10,950'],
      ['Rigid Insulation', '4,800', 'SF', '$7,200'],
      ['Structural Steel', '48', 'TON', '$96,000'],
    ].map((row, i) => (
      <div key={i} style={{ display: 'grid', gridTemplateColumns: '2.2fr 0.8fr 0.6fr 1fr', padding: '13px 0', borderTop: i === 0 ? 'none' : '1px solid #E7E5E1' }}>
        {row.map((cell, j) => (
          <div key={j} style={{ fontSize: 14, color: j === 3 ? GOLD : j === 0 ? TEXT : DIM, fontWeight: j === 3 ? 700 : j === 0 ? 600 : 500, fontVariantNumeric: 'tabular-nums', textAlign: j === 0 ? 'left' : 'right' }}>{cell}</div>
        ))}
      </div>
    ))}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6, paddingTop: 16, borderTop: `2px solid ${TEXT}` }}>
      <span style={{ fontSize: 15, fontWeight: 800, color: TEXT }}>Total Estimate</span>
      <span style={{ fontSize: 26, fontWeight: 800, color: GOLD, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>$137,070</span>
    </div>
  </div>
);

export default function Page() {
  return (
    <ProductPage data={{
      eyebrow: 'AI Blueprint Takeoff',
      title: <>Plans in.<br />Full estimate out<br />in 60 seconds.</>,
      subhead: 'Upload any PDF blueprint. Sage reads every dimension, counts every material, and prices a complete, CSI-coded estimate before your coffee’s cold — work that takes an estimator half a day.',
      visual,
      stats: [
        { value: '< 60s', label: 'Per blueprint' },
        { value: '47+', label: 'Line items, auto-coded' },
        { value: '4+ hrs', label: 'Saved per bid' },
      ],
      sections: [
        {
          title: 'It reads the drawing, not just the text',
          body: 'Sage measures real dimensions off the plan — footing runs, wall areas, slab square footage, rebar lengths — and converts them into quantities. No clicking every line by hand, no scale calibration headaches.',
          bullets: ['Reads PDF, PNG, and scanned drawings', 'Auto-detects scale and dimensions', 'Handles multi-page and multi-sheet sets', 'Works on architectural, structural, and civil plans'],
        },
        {
          title: 'Priced and CSI-coded automatically',
          body: 'Every item lands in the right CSI division with a unit cost and labor hours attached, so the output is a real estimate you can send — not a raw quantity dump you still have to price.',
          bullets: ['Materials priced from current cost data', 'Labor hours per line item', 'Grouped by CSI division', 'Export to CSV / Excel in one click'],
        },
        {
          title: 'Tune it, then send it',
          body: 'Adjust quantities, swap unit costs, set your contingency and margin, and the totals recompute live. Drop it straight into a bid package or proposal.',
          bullets: ['Live recalculating totals', 'Per-job contingency and margin', 'Confidence score on every analysis', 'Flows into bids, proposals, and pay apps'],
        },
      ],
      steps: [
        { title: 'Upload the plan', body: 'Drag in a PDF blueprint from any source — owner, architect, or plan room.' },
        { title: 'AI does the takeoff', body: 'Sage reads dimensions, counts materials, and prices each line in under a minute.' },
        { title: 'Review & adjust', body: 'Tweak quantities, costs, contingency, and margin with live totals.' },
        { title: 'Bid it', body: 'Send the estimate or roll it into a full bid package — same day.' },
      ],
      closingLine: 'Stop spending half a day on takeoffs.',
    }} />
  );
}
