'use client';
import React, { useState, useMemo } from 'react';

/* ─── Palette ─── */
const BG = '#0F1419', CARD = '#1A1F2E', GOLD = '#D4A017', GREEN = '#22C55E';
const BORDER = '#2A3040', TEXT = '#F0F4FF', DIM = '#8B9DB8', DARK = '#141922';
const RED = '#EF4444', BLUE = '#3B82F6';

const glass: React.CSSProperties = {
  background: `${CARD}CC`, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
  border: `1px solid ${BORDER}`, borderRadius: 16,
};

/* ─── State Data ─── */
type StateData = {
  name: string; electricity_rate: number; gas_rate: number; solar_hours: number;
  rebates: number; climate: string;
};

const STATES: Record<string, StateData> = {
  AZ: { name: 'Arizona', electricity_rate: 0.13, gas_rate: 1.05, solar_hours: 6.5, rebates: 2500, climate: 'Hot & Dry' },
  CA: { name: 'California', electricity_rate: 0.27, gas_rate: 1.45, solar_hours: 5.8, rebates: 4000, climate: 'Mediterranean' },
  CO: { name: 'Colorado', electricity_rate: 0.14, gas_rate: 0.85, solar_hours: 5.5, rebates: 2000, climate: 'Mixed' },
  FL: { name: 'Florida', electricity_rate: 0.14, gas_rate: 1.20, solar_hours: 5.6, rebates: 1500, climate: 'Hot & Humid' },
  GA: { name: 'Georgia', electricity_rate: 0.13, gas_rate: 0.95, solar_hours: 5.0, rebates: 1200, climate: 'Hot & Humid' },
  IL: { name: 'Illinois', electricity_rate: 0.16, gas_rate: 0.80, solar_hours: 4.2, rebates: 3000, climate: 'Cold' },
  MA: { name: 'Massachusetts', electricity_rate: 0.25, gas_rate: 1.30, solar_hours: 4.0, rebates: 3500, climate: 'Cold' },
  MI: { name: 'Michigan', electricity_rate: 0.18, gas_rate: 0.75, solar_hours: 3.8, rebates: 2000, climate: 'Cold' },
  MN: { name: 'Minnesota', electricity_rate: 0.14, gas_rate: 0.70, solar_hours: 4.3, rebates: 2500, climate: 'Cold' },
  NC: { name: 'North Carolina', electricity_rate: 0.12, gas_rate: 0.90, solar_hours: 5.0, rebates: 2000, climate: 'Temperate' },
  NJ: { name: 'New Jersey', electricity_rate: 0.17, gas_rate: 1.10, solar_hours: 4.3, rebates: 3000, climate: 'Temperate' },
  NV: { name: 'Nevada', electricity_rate: 0.12, gas_rate: 1.00, solar_hours: 6.4, rebates: 2500, climate: 'Hot & Dry' },
  NY: { name: 'New York', electricity_rate: 0.22, gas_rate: 1.25, solar_hours: 3.9, rebates: 5000, climate: 'Cold' },
  OH: { name: 'Ohio', electricity_rate: 0.13, gas_rate: 0.80, solar_hours: 3.8, rebates: 1500, climate: 'Cold' },
  OR: { name: 'Oregon', electricity_rate: 0.12, gas_rate: 0.95, solar_hours: 4.2, rebates: 3000, climate: 'Temperate' },
  PA: { name: 'Pennsylvania', electricity_rate: 0.15, gas_rate: 0.90, solar_hours: 4.0, rebates: 2500, climate: 'Cold' },
  TX: { name: 'Texas', electricity_rate: 0.12, gas_rate: 0.85, solar_hours: 5.6, rebates: 1500, climate: 'Hot & Dry' },
  VA: { name: 'Virginia', electricity_rate: 0.13, gas_rate: 0.95, solar_hours: 4.5, rebates: 2500, climate: 'Temperate' },
  WA: { name: 'Washington', electricity_rate: 0.11, gas_rate: 0.90, solar_hours: 3.6, rebates: 3000, climate: 'Temperate' },
  WI: { name: 'Wisconsin', electricity_rate: 0.15, gas_rate: 0.75, solar_hours: 4.0, rebates: 2000, climate: 'Cold' },
};

/* ─── Upgrade Definitions ─── */
type Upgrade = {
  id: string; name: string; icon: string;
  cost_low: number; cost_high: number;
  base_savings: number; // base annual savings before state multiplier
  multiplier_key: 'electricity' | 'gas' | 'solar' | 'water';
  has_slider?: boolean; slider_label?: string; slider_min?: number; slider_max?: number;
};

const UPGRADES: Upgrade[] = [
  { id: 'thermostat', name: 'Smart Thermostat', icon: '🌡️', cost_low: 200, cost_high: 500, base_savings: 180, multiplier_key: 'electricity' },
  { id: 'lighting', name: 'Smart Lighting', icon: '💡', cost_low: 800, cost_high: 2400, base_savings: 240, multiplier_key: 'electricity' },
  { id: 'solar', name: 'Solar Panels', icon: '☀️', cost_low: 2000, cost_high: 3000, base_savings: 300, multiplier_key: 'solar', has_slider: true, slider_label: 'System Size (kW)', slider_min: 2, slider_max: 16 },
  { id: 'battery', name: 'Battery Wall', icon: '🔋', cost_low: 8000, cost_high: 14000, base_savings: 480, multiplier_key: 'electricity' },
  { id: 'ev', name: 'EV Charging', icon: '🔌', cost_low: 800, cost_high: 2400, base_savings: 600, multiplier_key: 'electricity' },
  { id: 'irrigation', name: 'Smart Irrigation', icon: '💧', cost_low: 400, cost_high: 1200, base_savings: 320, multiplier_key: 'water' },
  { id: 'heatpump', name: 'Heat Pump', icon: '♨️', cost_low: 4000, cost_high: 8000, base_savings: 720, multiplier_key: 'gas' },
  { id: 'insulation', name: 'Insulation Upgrade', icon: '🧱', cost_low: 2000, cost_high: 6000, base_savings: 540, multiplier_key: 'electricity' },
  { id: 'waterheater', name: 'Smart Water Heater', icon: '🚿', cost_low: 1200, cost_high: 3000, base_savings: 360, multiplier_key: 'gas' },
];

export default function ROICalculatorPage() {
  const [state, setState] = useState('AZ');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [solarKw, setSolarKw] = useState(8);

  const sd = STATES[state];

  const multipliers = useMemo(() => ({
    electricity: sd.electricity_rate / 0.14,
    gas: sd.gas_rate / 0.90,
    solar: sd.solar_hours / 4.5,
    water: 1.0,
  }), [sd]);

  const calculations = useMemo(() => {
    let totalCostLow = 0, totalCostHigh = 0, totalAnnual = 0;
    const items: { name: string; cost: string; savings: number }[] = [];

    UPGRADES.forEach(u => {
      if (!selected[u.id]) return;
      let costLow = u.cost_low, costHigh = u.cost_high, savings = u.base_savings;
      if (u.id === 'solar') {
        costLow = u.cost_low * solarKw;
        costHigh = u.cost_high * solarKw;
        savings = u.base_savings * solarKw;
      }
      savings = Math.round(savings * multipliers[u.multiplier_key]);
      totalCostLow += costLow;
      totalCostHigh += costHigh;
      totalAnnual += savings;
      items.push({ name: u.name, cost: `$${costLow.toLocaleString()} - $${costHigh.toLocaleString()}`, savings });
    });

    const avgCost = (totalCostLow + totalCostHigh) / 2;
    const roiYears = totalAnnual > 0 ? +(avgCost / totalAnnual).toFixed(1) : 0;
    const tenYearNet = totalAnnual * 10 - avgCost;
    const homeValueIncrease = Math.round(avgCost * 0.65);

    return {
      items, totalCostLow, totalCostHigh, totalAnnual,
      monthlySavings: Math.round(totalAnnual / 12),
      roiYears, tenYearNet, homeValueIncrease,
    };
  }, [selected, solarKw, multipliers]);

  // Bar chart data for years 1-10
  const chartBars = useMemo(() => {
    const avgCost = (calculations.totalCostLow + calculations.totalCostHigh) / 2;
    return Array.from({ length: 10 }, (_, i) => ({
      year: i + 1,
      savings: calculations.totalAnnual * (i + 1),
      cost: avgCost,
    }));
  }, [calculations]);

  const maxChart = Math.max(...chartBars.map(b => Math.max(b.savings, b.cost)), 1);
  const fmt = (n: number) => '$' + Math.abs(n).toLocaleString();

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT }}>
      {/* Header */}
      <section style={{
        textAlign: 'center', padding: '80px 20px 40px',
        background: `linear-gradient(180deg, ${DARK} 0%, ${BG} 100%)`,
      }}>
        <h1 style={{ fontSize: 'clamp(26px, 5vw, 44px)', fontWeight: 800, marginBottom: 12 }}>
          Smart Home <span style={{ color: GOLD }}>ROI Calculator</span>
        </h1>
        <p style={{ fontSize: 17, color: DIM, maxWidth: 600, margin: '0 auto' }}>
          See exactly how much you can save with smart upgrades in your state.
        </p>
      </section>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 380px)', gap: 24, alignItems: 'start' }}>
          {/* Left: Controls */}
          <div>
            {/* State Selector */}
            <div style={{ ...glass, padding: 20, marginBottom: 20 }}>
              <label style={{ fontSize: 14, fontWeight: 700, display: 'block', marginBottom: 8 }}>
                Your State
              </label>
              <select value={state} onChange={e => setState(e.target.value)} style={{
                width: '100%', padding: '12px 16px', background: BG,
                border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT,
                fontSize: 15, outline: 'none', cursor: 'pointer',
              }}>
                {Object.entries(STATES).map(([code, s]) => (
                  <option key={code} value={code}>{s.name}</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: DIM }}>
                  Electricity: <strong style={{ color: GOLD }}>${sd.electricity_rate}/kWh</strong>
                </span>
                <span style={{ fontSize: 12, color: DIM }}>
                  Solar Hours: <strong style={{ color: GOLD }}>{sd.solar_hours}h/day</strong>
                </span>
                <span style={{ fontSize: 12, color: DIM }}>
                  Climate: <strong style={{ color: GOLD }}>{sd.climate}</strong>
                </span>
              </div>
            </div>

            {/* Upgrade Checklist */}
            <div style={{ ...glass, padding: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Select Upgrades</h3>
              {UPGRADES.map(u => {
                const isOn = !!selected[u.id];
                let costLow = u.cost_low, costHigh = u.cost_high;
                let savings = u.base_savings;
                if (u.id === 'solar' && isOn) {
                  costLow = u.cost_low * solarKw;
                  costHigh = u.cost_high * solarKw;
                  savings = u.base_savings * solarKw;
                }
                savings = Math.round(savings * multipliers[u.multiplier_key]);
                return (
                  <div key={u.id} style={{
                    padding: '12px 14px', borderRadius: 12, marginBottom: 8,
                    background: isOn ? `${GOLD}10` : 'transparent',
                    border: `1px solid ${isOn ? GOLD + '40' : BORDER}`,
                    transition: 'all .2s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button onClick={() => setSelected(p => ({ ...p, [u.id]: !p[u.id] }))} style={{
                        width: 24, height: 24, borderRadius: 6,
                        border: `2px solid ${isOn ? GOLD : BORDER}`,
                        background: isOn ? GOLD : 'transparent',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#000', fontSize: 14, fontWeight: 800,
                      }}>
                        {isOn ? '✓' : ''}
                      </button>
                      <span style={{ fontSize: 20 }}>{u.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</div>
                        <div style={{ fontSize: 12, color: DIM }}>
                          ${costLow.toLocaleString()} - ${costHigh.toLocaleString()}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: isOn ? GREEN : DIM }}>
                          {isOn ? `$${savings}/yr` : '—'}
                        </div>
                      </div>
                    </div>
                    {u.has_slider && isOn && (
                      <div style={{ marginTop: 10, paddingLeft: 36 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: DIM, marginBottom: 4 }}>
                          <span>{u.slider_label}</span>
                          <span style={{ color: GOLD, fontWeight: 700 }}>{solarKw} kW</span>
                        </div>
                        <input type="range" min={u.slider_min} max={u.slider_max} value={solarKw}
                          onChange={e => setSolarKw(+e.target.value)}
                          style={{ width: '100%', accentColor: GOLD }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Results Panel */}
          <div style={{ position: 'sticky', top: 20 }}>
            <div style={{ ...glass, padding: 24, marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, textAlign: 'center' }}>
                Your Savings Summary
              </h3>

              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: DIM, marginBottom: 4 }}>Annual Savings</div>
                <div style={{ fontSize: 40, fontWeight: 800, color: GREEN }}>
                  {fmt(calculations.totalAnnual)}
                </div>
                <div style={{ fontSize: 14, color: DIM }}>
                  {fmt(calculations.monthlySavings)}/month
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div style={{ background: `${BG}80`, borderRadius: 10, padding: 14, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: DIM, marginBottom: 4 }}>Total Cost</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>
                    {calculations.totalCostLow > 0
                      ? `${fmt(calculations.totalCostLow)} - ${fmt(calculations.totalCostHigh)}`
                      : '$0'
                    }
                  </div>
                </div>
                <div style={{ background: `${BG}80`, borderRadius: 10, padding: 14, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: DIM, marginBottom: 4 }}>ROI (Payoff)</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: GOLD }}>
                    {calculations.roiYears > 0 ? `${calculations.roiYears} yrs` : '—'}
                  </div>
                </div>
                <div style={{ background: `${BG}80`, borderRadius: 10, padding: 14, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: DIM, marginBottom: 4 }}>10-Year Net</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: calculations.tenYearNet >= 0 ? GREEN : RED }}>
                    {calculations.tenYearNet >= 0 ? '+' : '-'}{fmt(calculations.tenYearNet)}
                  </div>
                </div>
                <div style={{ background: `${BG}80`, borderRadius: 10, padding: 14, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: DIM, marginBottom: 4 }}>Home Value +</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: BLUE }}>
                    {calculations.homeValueIncrease > 0 ? `+${fmt(calculations.homeValueIncrease)}` : '—'}
                  </div>
                </div>
              </div>

              {/* Bar Chart */}
              {calculations.totalAnnual > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: DIM, marginBottom: 10, textAlign: 'center' }}>
                    Cumulative Savings vs. Investment Cost
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 140 }}>
                    {chartBars.map(bar => {
                      const savH = (bar.savings / maxChart) * 130;
                      const costH = (bar.cost / maxChart) * 130;
                      const breakEven = bar.savings >= bar.cost;
                      return (
                        <div key={bar.year} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <div style={{ position: 'relative', width: '100%', display: 'flex', gap: 1, justifyContent: 'center' }}>
                            <div style={{
                              width: '45%', height: savH, borderRadius: '4px 4px 0 0',
                              background: breakEven ? GREEN : `${GREEN}80`,
                              transition: 'height .5s ease',
                            }} />
                            <div style={{
                              width: '45%', height: costH, borderRadius: '4px 4px 0 0',
                              background: `${RED}60`,
                              transition: 'height .5s ease',
                            }} />
                          </div>
                          <div style={{ fontSize: 10, color: DIM }}>{bar.year}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: DIM }}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, background: GREEN, borderRadius: 2, marginRight: 4 }} />
                      Savings
                    </span>
                    <span style={{ fontSize: 11, color: DIM }}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, background: `${RED}60`, borderRadius: 2, marginRight: 4 }} />
                      Cost
                    </span>
                  </div>
                </div>
              )}

              <a href="/design/discover" style={{ textDecoration: 'none', display: 'block' }}>
                <button style={{
                  width: '100%', padding: '14px', background: `linear-gradient(135deg, ${GOLD}, #B8860B)`,
                  color: '#000', border: 'none', borderRadius: 12, fontWeight: 700,
                  fontSize: 15, cursor: 'pointer',
                }}>
                  Get a Custom Quote
                </button>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Responsive override for mobile */}
      <style>{`
        @media (max-width: 768px) {
          div[style*="grid-template-columns: minmax(0, 1fr) minmax(300px"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
