/**
 * lib/earned-value.ts — Earned Value Management + cost/schedule forecasting.
 *
 * The metrics Procore's analytics surface: CPI/SPI, variances, and the
 * forecast family (EAC/ETC/VAC/TCPI) plus a composite project risk score and
 * projected completion. Pure functions → deterministic + unit-testable.
 */

export interface EVMInput {
  bac: number;            // Budget At Completion
  pv: number;             // Planned Value to date
  ev: number;             // Earned Value to date (% complete * BAC)
  ac: number;             // Actual Cost to date
  original_duration?: number; // days
  elapsed?: number;       // days elapsed
}

export interface EVMResult {
  cv: number; sv: number; cpi: number; spi: number;
  eac_cpi: number;        // BAC / CPI
  eac_composite: number;  // AC + (BAC-EV)/(CPI*SPI)
  etc: number;            // EAC - AC
  vac: number;            // BAC - EAC
  tcpi: number;           // (BAC-EV)/(BAC-AC)
  percent_complete: number;
  percent_spent: number;
  cost_status: 'under' | 'on' | 'over';
  schedule_status: 'ahead' | 'on' | 'behind';
  projected_duration: number | null;
  risk_score: number;     // 0-100, higher = riskier
  risk_level: 'low' | 'moderate' | 'high' | 'critical';
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function computeEVM(i: EVMInput): EVMResult {
  const bac = i.bac || 0, pv = i.pv || 0, ev = i.ev || 0, ac = i.ac || 0;
  const cpi = ac > 0 ? ev / ac : 1;
  const spi = pv > 0 ? ev / pv : 1;
  const cv = ev - ac;
  const sv = ev - pv;
  const eac_cpi = cpi > 0 ? bac / cpi : bac;
  const denom = cpi * spi;
  const eac_composite = denom > 0 ? ac + (bac - ev) / denom : eac_cpi;
  const etc = eac_cpi - ac;
  const vac = bac - eac_cpi;
  const tcpi = (bac - ac) !== 0 ? (bac - ev) / (bac - ac) : 0;
  const percent_complete = bac > 0 ? (ev / bac) * 100 : 0;
  const percent_spent = bac > 0 ? (ac / bac) * 100 : 0;

  const projected_duration = (i.original_duration && spi > 0)
    ? Math.round(i.original_duration / spi)
    : null;

  // Risk: weighted blend of cost overrun, schedule slip, and burn-ahead.
  // Scaled so a ~20% cost/schedule shortfall (CPI/SPI ≈ 0.8) lands as "high".
  const costRisk = cpi >= 1 ? 0 : Math.min(100, (1 - cpi) * 250);
  const schedRisk = spi >= 1 ? 0 : Math.min(100, (1 - spi) * 250);
  const burnRisk = percent_complete > 0 && percent_spent > percent_complete
    ? Math.min(100, (percent_spent - percent_complete) * 2) : 0;
  const risk_score = Math.round(costRisk * 0.45 + schedRisk * 0.4 + burnRisk * 0.15);
  const risk_level = risk_score >= 66 ? 'critical' : risk_score >= 40 ? 'high' : risk_score >= 18 ? 'moderate' : 'low';

  return {
    cv: r2(cv), sv: r2(sv), cpi: r2(cpi), spi: r2(spi),
    eac_cpi: r2(eac_cpi), eac_composite: r2(eac_composite),
    etc: r2(etc), vac: r2(vac), tcpi: r2(tcpi),
    percent_complete: r2(percent_complete), percent_spent: r2(percent_spent),
    cost_status: cv > bac * 0.005 ? 'under' : cv < -bac * 0.005 ? 'over' : 'on',
    schedule_status: sv > bac * 0.005 ? 'ahead' : sv < -bac * 0.005 ? 'behind' : 'on',
    projected_duration,
    risk_score, risk_level,
  };
}
