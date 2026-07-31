'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Table, T } from '@/components/ui/shell';
import { PremiumSurface, ModuleHero, StatCard, SectionCard, PremiumEmpty, goldButtonStyle } from '@/components/ui/premium';
import { toCents, toDollars, extend, sumCents, addCents } from '@/lib/calc';
import { Package, HardHat, CurrencyDollar, Ruler, Rows, Receipt, DownloadSimple } from '@phosphor-icons/react';

interface EstimateLine {
  csi_code: string;
  description: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total: number;
}

interface TakeoffData {
  id: string;
  materials: EstimateLine[];
  labor_cost: number;
  material_cost: number;
  total_cost: number;
  square_footage: number;
}

const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function EstimatePage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [takeoff, setTakeoff] = useState<TakeoffData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchTakeoff = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/takeoffs/latest?projectId=${projectId}`);
      if (!res.ok) { setTakeoff(null); return; }
      const data = await res.json();
      if (data.takeoff) {
        const t = data.takeoff;
        const materials: EstimateLine[] = (t.materials || t.line_items || []).map((m: any) => {
          const quantity = m.quantity || 0;
          const unit_cost = m.unit_cost || m.unit_price || 0;
          // Line extended cost = quantity × unit cost, exact cents (never float qty*price).
          const lineCents = m.total ? toCents(m.total) : extend(quantity, toCents(unit_cost));
          return {
            csi_code: m.csi_code || m.code || '',
            description: m.description || m.name || '',
            quantity,
            unit: m.unit || 'EA',
            unit_cost,
            total: toDollars(lineCents),
          };
        });
        const materialCents = sumCents(materials.map(m => toCents(m.total)));
        const laborCents = toCents(t.labor_cost || 0);
        const materialCost = toDollars(materialCents);
        setTakeoff({
          id: t.id,
          materials,
          labor_cost: toDollars(laborCents),
          material_cost: materialCost,
          total_cost: toDollars(addCents(materialCents, laborCents)),
          square_footage: t.square_footage || t.sqft || 0,
        });
      } else {
        setTakeoff(null);
      }
    } catch {
      setTakeoff(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchTakeoff(); }, [fetchTakeoff]);

  function exportCSV() {
    if (!takeoff) return;
    setExporting(true);
    const header = 'CSI Code,Description,Quantity,Unit,Unit Cost,Total\n';
    const rows = takeoff.materials.map(m =>
      `"${m.csi_code}","${m.description}",${m.quantity},"${m.unit}",${m.unit_cost},${m.total}`
    ).join('\n');
    const summary = `\n\nMaterial Cost,,,,,"${fmt(takeoff.material_cost)}"\nLabor Cost,,,,,"${fmt(takeoff.labor_cost)}"\nTotal,,,,,"${fmt(takeoff.total_cost)}"`;
    if (takeoff.square_footage > 0) {
      const costPerSF = takeoff.total_cost / takeoff.square_footage;
      // appending to summary
    }
    const blob = new Blob([header + rows + summary], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estimate-${projectId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  }

  return (
    <PremiumSurface maxWidth={1600}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: T.muted }}>Loading estimate data...</div>
      ) : !takeoff ? (
        <>
          <ModuleHero
            eyebrow="Estimating"
            eyebrowIcon={<Ruler size={13} weight="fill" color="#F59E0B" />}
            title="Project"
            accent="Estimate"
            subtitle="Cost estimate from latest takeoff analysis"
          />
          <SectionCard>
            <PremiumEmpty
              icon={<Package size={30} weight="duotone" color="#F59E0B" />}
              title="No takeoff data"
              description="Run a blueprint analysis first to generate estimate line items."
              action={
                <a href={`/app/projects/${projectId}/takeoff`} style={goldButtonStyle} className="pmBtn">Go to Takeoff</a>
              }
            />
          </SectionCard>
        </>
      ) : (
        <>
          <ModuleHero
            eyebrow="Estimating"
            eyebrowIcon={<Ruler size={13} weight="fill" color="#F59E0B" />}
            title="Project"
            accent="Estimate"
            subtitle="Cost estimate from latest takeoff analysis"
            actions={
              <button
                onClick={exportCSV}
                disabled={exporting}
                className="pmBtn"
                style={{ ...goldButtonStyle, opacity: exporting ? 0.6 : 1, cursor: exporting ? 'not-allowed' : 'pointer' }}
              >
                <DownloadSimple size={15} weight="bold" /> {exporting ? 'Exporting...' : 'Export CSV'}
              </button>
            }
          />

          {/* Summary Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
            <StatCard icon={<Package size={19} weight="duotone" color="#F59E0B" />} label="Material Cost" value={fmt(takeoff.material_cost)} />
            <StatCard icon={<HardHat size={19} weight="duotone" color="#F59E0B" />} label="Labor Cost" value={fmt(takeoff.labor_cost)} />
            <StatCard icon={<CurrencyDollar size={19} weight="duotone" color="#F59E0B" />} label="Total" value={fmt(takeoff.total_cost)} accent="#F59E0B" />
            <StatCard
              icon={<Ruler size={19} weight="duotone" color="#F59E0B" />}
              label="Cost per SF"
              value={takeoff.square_footage > 0 ? fmt(takeoff.total_cost / takeoff.square_footage) : 'N/A'}
              sub={takeoff.square_footage > 0 ? `${takeoff.square_footage.toLocaleString()} SF` : undefined}
            />
          </div>

          {/* Line Items Table */}
          <SectionCard
            title="Line Items"
            icon={<Rows size={17} weight="duotone" color="#F59E0B" />}
            action={<span style={{ fontSize: 12, color: T.muted }}>{takeoff.materials.length} items</span>}
            flush
          >
            <Table
              headers={['CSI Code', 'Description', 'Quantity', 'Unit', 'Unit Cost', 'Total']}
              rows={takeoff.materials.map(m => [
                <span key="c" style={{ color: T.gold, fontWeight: 600, fontFamily: 'monospace' }}>{m.csi_code}</span>,
                m.description,
                <span key="q" style={{ color: T.white }}>{m.quantity.toLocaleString()}</span>,
                <span key="u" style={{ color: T.muted }}>{m.unit}</span>,
                <span key="uc" style={{ color: T.muted }}>{fmt(m.unit_cost)}</span>,
                <span key="t" style={{ fontWeight: 600, color: T.white }}>{fmt(m.total)}</span>,
              ])}
            />
          </SectionCard>

          {/* Summary Footer */}
          <SectionCard
            title="Estimate Summary"
            icon={<Receipt size={17} weight="duotone" color="#F59E0B" />}
            style={{ marginTop: 20 }}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 32, flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, textTransform: 'uppercase', marginBottom: 4 }}>Material Cost</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.white }}>{fmt(takeoff.material_cost)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, textTransform: 'uppercase', marginBottom: 4 }}>Labor Cost</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.white }}>{fmt(takeoff.labor_cost)}</div>
              </div>
              <div style={{ textAlign: 'right', paddingLeft: 24, borderLeft: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.gold, textTransform: 'uppercase', marginBottom: 4 }}>Total</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: T.white }}>{fmt(takeoff.total_cost)}</div>
              </div>
              {takeoff.square_footage > 0 && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, textTransform: 'uppercase', marginBottom: 4 }}>Cost per SF</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: T.gold }}>{fmt(takeoff.total_cost / takeoff.square_footage)}</div>
                </div>
              )}
            </div>
          </SectionCard>
        </>
      )}
    </PremiumSurface>
  );
}
