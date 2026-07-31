'use client';
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ProgressBar, Badge, T } from '@/components/ui/shell';
import {
  PremiumSurface,
  ModuleHero,
  StatCard,
  SectionCard,
  goldButtonStyle,
  ghostButtonStyle,
} from '@/components/ui/premium';
import { CheckCircle, Hourglass, ChartBar, Check, Package, ListChecks } from '@phosphor-icons/react';

interface ChecklistItem {
  id: string;
  label: string;
  status: 'complete' | 'incomplete';
  generateEndpoint?: string;
  generateLabel?: string;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  { id: 'final_pay_app', label: 'Final Pay App', status: 'incomplete' },
  { id: 'g706_affidavit', label: 'G706 Affidavit', status: 'incomplete', generateEndpoint: '/api/documents/g706', generateLabel: 'Generate G706' },
  { id: 'all_lien_waivers', label: 'All Lien Waivers', status: 'incomplete' },
  { id: 'g704_certificate', label: 'G704 Certificate of Substantial Completion', status: 'incomplete', generateEndpoint: '/api/documents/g704', generateLabel: 'Generate G704' },
  { id: 'bond_rider', label: 'Bond Rider', status: 'incomplete' },
  { id: 'w9_forms', label: 'W-9 Forms', status: 'incomplete' },
  { id: 'wh347_final', label: 'WH-347 Final Certified Payroll', status: 'incomplete' },
  { id: 'as_built_drawings', label: 'As-Built Drawings', status: 'incomplete' },
  { id: 'equipment_warranties', label: 'Equipment Warranties', status: 'incomplete' },
  { id: 'om_manuals', label: 'O&M Manuals', status: 'incomplete' },
  { id: 'final_inspection', label: 'Final Inspection', status: 'incomplete' },
  { id: 'certificate_of_occupancy', label: 'Certificate of Occupancy', status: 'incomplete' },
];

export default function CloseoutPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [items, setItems] = useState<ChecklistItem[]>(CHECKLIST_ITEMS);
  const [generating, setGenerating] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/closeout/checklist`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.items && Array.isArray(data.items)) {
          setItems(prev => prev.map(item => {
            const saved = data.items.find((s: any) => s.id === item.id);
            return saved ? { ...item, status: saved.status } : item;
          }));
        }
      } catch { /* use defaults */ }
    })();
  }, [projectId]);

  const completed = items.filter(i => i.status === 'complete').length;
  const total = items.length;
  const pct = Math.round((completed / total) * 100);
  const exportDisabled = exporting || pct < 100;

  async function toggleItem(id: string) {
    const prevItems = items;
    const newItems = items.map(i =>
      i.id === id ? { ...i, status: (i.status === 'complete' ? 'incomplete' : 'complete') as 'complete' | 'incomplete' } : i
    );
    setItems(newItems);
    try {
      const res = await fetch(`/api/projects/${projectId}/closeout/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: newItems.map(i => ({ id: i.id, status: i.status })) }),
      });
      if (!res.ok) throw new Error('save failed');
    } catch {
      // Revert the optimistic toggle so the UI reflects what actually persisted.
      setItems(prevItems);
      setToast('Could not save the checklist. Please try again.');
      setTimeout(() => setToast(''), 4000);
    }
  }

  async function generateDoc(item: ChecklistItem) {
    if (!item.generateEndpoint) return;
    setGenerating(item.id);
    try {
      const res = await fetch(item.generateEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json().catch(() => ({}));
      const url = data.url || data.pdfUrl || data.downloadUrl;
      if (!res.ok || !url) throw new Error(data.error || 'generation failed');
      window.open(url, '_blank');
      setToast(`${item.generateLabel} generated successfully.`);
    } catch {
      setToast(`Could not generate ${item.generateLabel}. Please try again.`);
    } finally {
      setGenerating(null);
      setTimeout(() => setToast(''), 4000);
    }
  }

  async function exportCloseout() {
    setExporting(true);
    try {
      const res = await fetch('/api/documents/closeout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json().catch(() => ({}));
      const url = data.url || data.pdfUrl || data.downloadUrl;
      if (!res.ok || !url) throw new Error(data.error || 'generation failed');
      window.open(url, '_blank');
      setToast('Closeout package generated.');
    } catch {
      setToast('Could not generate the closeout package. Please try again.');
    } finally {
      setExporting(false);
      setTimeout(() => setToast(''), 4000);
    }
  }

  return (
    <PremiumSurface maxWidth={1600}>
      {/* Header */}
      <ModuleHero
        eyebrow="Closeout"
        eyebrowIcon={<Package size={13} weight="fill" color="#F59E0B" />}
        title="Project"
        accent="Closeout"
        subtitle={`${completed} of ${total} items complete — ${pct}% ready for handover.`}
        actions={
          <>
            <button
              onClick={() => generateDoc({ id: 'g704', label: 'G704', status: 'incomplete', generateEndpoint: '/api/documents/g704', generateLabel: 'G704' })}
              disabled={!!generating}
              className="pmBtn"
              style={{ ...ghostButtonStyle, opacity: generating ? 0.5 : 1, cursor: generating ? 'not-allowed' : 'pointer' }}
            >
              Generate G704
            </button>
            <button
              onClick={() => generateDoc({ id: 'g706', label: 'G706', status: 'incomplete', generateEndpoint: '/api/documents/g706', generateLabel: 'G706' })}
              disabled={!!generating}
              className="pmBtn"
              style={{ ...ghostButtonStyle, opacity: generating ? 0.5 : 1, cursor: generating ? 'not-allowed' : 'pointer' }}
            >
              Generate G706
            </button>
            <button
              onClick={exportCloseout}
              disabled={exportDisabled}
              className="pmBtn"
              style={{ ...goldButtonStyle, opacity: exportDisabled ? 0.5 : 1, cursor: exportDisabled ? 'not-allowed' : 'pointer' }}
            >
              {exporting ? 'Generating...' : 'Export Closeout Package'}
            </button>
          </>
        }
      />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard
          icon={<CheckCircle size={19} weight="duotone" color={T.green} />}
          label="Completed"
          value={String(completed)}
          sub={`of ${total} items`}
          accent={completed > 0 ? T.green : undefined}
          delay={0.02}
        />
        <StatCard
          icon={<Hourglass size={19} weight="duotone" color="#F59E0B" />}
          label="Remaining"
          value={String(total - completed)}
          sub={total - completed === 0 ? 'all complete' : 'still outstanding'}
          delay={0.06}
        />
        <StatCard
          icon={<ChartBar size={19} weight="duotone" color="#F59E0B" />}
          label="Progress"
          value={`${pct}%`}
          sub={pct === 100 ? 'ready to export' : 'to handover'}
          accent={pct === 100 ? T.green : '#F59E0B'}
          delay={0.10}
        />
      </div>

      {toast && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: T.greenDim, border: `1px solid rgba(34,197,94,0.3)`, borderRadius: 10, color: T.green, fontSize: 13 }}>
          {toast}
        </div>
      )}

      {/* Progress Bar */}
      <SectionCard
        title="Closeout Progress"
        icon={<ChartBar size={17} weight="duotone" color="#F59E0B" />}
        action={<span style={{ fontSize: 14, fontWeight: 800, color: pct === 100 ? T.green : '#FBBF24', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>}
        style={{ marginBottom: 24 }}
      >
        <ProgressBar pct={pct} color={pct === 100 ? T.green : T.gold} height={10} />
        <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.62)' }}>
          {pct === 100 ? 'Ready to export closeout package' : `${total - completed} items remaining`}
        </div>
      </SectionCard>

      {/* Checklist */}
      <SectionCard
        title="Closeout Checklist"
        subtitle={`${completed}/${total} complete`}
        icon={<ListChecks size={17} weight="duotone" color="#F59E0B" />}
        flush
      >
        {items.map((item, idx) => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: idx === items.length - 1 ? 'none' : `1px solid rgba(255,255,255,0.06)` }}>
            <button
              onClick={() => toggleItem(item.id)}
              style={{
                width: 22, height: 22, borderRadius: 6,
                border: `2px solid ${item.status === 'complete' ? T.green : 'rgba(255,255,255,0.22)'}`,
                background: item.status === 'complete' ? T.green : 'transparent',
                cursor: 'pointer', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {item.status === 'complete' && <Check size={14} weight="bold" color="#000" />}
            </button>
            <span style={{
              flex: 1, fontSize: 14, color: item.status === 'complete' ? T.green : '#FFFFFF',
              textDecoration: item.status === 'complete' ? 'line-through' : 'none',
            }}>
              {item.label}
            </span>
            <Badge label={item.status === 'complete' ? 'Complete' : 'Incomplete'} color={item.status === 'complete' ? 'green' : 'muted'} />
            {item.generateEndpoint && (
              <button
                onClick={() => generateDoc(item)}
                disabled={generating === item.id}
                className="pmBtn"
                style={{ ...ghostButtonStyle, padding: '7px 14px', fontSize: 12.5, opacity: generating === item.id ? 0.5 : 1, cursor: generating === item.id ? 'not-allowed' : 'pointer' }}
              >
                {generating === item.id ? 'Generating...' : item.generateLabel}
              </button>
            )}
          </div>
        ))}
      </SectionCard>
    </PremiumSurface>
  );
}
