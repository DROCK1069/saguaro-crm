'use client';
import useSWR, { mutate } from 'swr';

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) {
    // 403 = tenant not entitled; return empty so the (gated) page renders nothing sensitive.
    if (r.status === 403 || r.status === 401) return {};
    throw new Error(`Request failed (${r.status})`);
  }
  return r.json();
};

const opts = { refreshInterval: 60_000, revalidateOnFocus: true, dedupingInterval: 10_000 } as const;

/* ── Long-lead procurement ─────────────────────────────────────────── */
const LONG_LEAD = '/api/franchise/long-lead';
export function useLongLead() {
  const { data, error, isLoading, mutate: revalidate } = useSWR<{ items?: any[] }>(LONG_LEAD, fetcher, opts);
  return { items: data?.items ?? [], loading: isLoading, error, revalidate };
}
export async function createLongLead(payload: Record<string, any>) {
  const res = await fetch(LONG_LEAD, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed to add item');
  await mutate(LONG_LEAD);
  return res.json();
}
export async function advanceLongLead(id: string, status?: string) {
  const res = await fetch(LONG_LEAD, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed to advance');
  await mutate(LONG_LEAD);
  return res.json();
}

/* ── Risk register ─────────────────────────────────────────────────── */
const RISKS = '/api/franchise/risks';
export function useRisks() {
  const { data, error, isLoading, mutate: revalidate } = useSWR<{ risks?: any[] }>(RISKS, fetcher, opts);
  return { risks: data?.risks ?? [], loading: isLoading, error, revalidate };
}
export async function createRisk(payload: Record<string, any>) {
  const res = await fetch(RISKS, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed to add risk');
  await mutate(RISKS);
  return res.json();
}

/* ── Schedule milestones (read-only rollup) ────────────────────────── */
export function useMilestones() {
  const { data, error, isLoading, mutate: revalidate } = useSWR<{ milestones?: any[] }>('/api/franchise/milestones', fetcher, opts);
  return { milestones: data?.milestones ?? [], loading: isLoading, error, revalidate };
}

/* ── Escalations (read-only rollup) ────────────────────────────────── */
export function useEscalations() {
  const { data, error, isLoading, mutate: revalidate } = useSWR<{ escalations?: any[] }>('/api/franchise/escalations', fetcher, opts);
  return { escalations: data?.escalations ?? [], loading: isLoading, error, revalidate };
}

/* ── Rollout pipeline (reads projects via useProjects; writes here) ──── */
const PROJECTS_KEY = '/api/projects/list';
export async function moveStage(projectId: string, rollout_stage: string) {
  const res = await fetch('/api/franchise/pipeline', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: projectId, rollout_stage }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed to move stage');
  await mutate(PROJECTS_KEY);
  return res.json();
}
export async function launchSite(payload: Record<string, any>) {
  const res = await fetch('/api/franchise/launch-site', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed to launch site');
  await mutate(PROJECTS_KEY);
  return res.json();
}

/* ── OAC meetings + action items ───────────────────────────────────── */
const OAC_KEY = '/api/franchise/meetings';
export function useOAC() {
  const { data, error, isLoading, mutate: revalidate } = useSWR<{ meetings?: any[]; actions?: any[] }>(OAC_KEY, fetcher, opts);
  return { meetings: data?.meetings ?? [], actions: data?.actions ?? [], loading: isLoading, error, revalidate };
}
export async function createMeeting(payload: Record<string, any>) {
  const res = await fetch(OAC_KEY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed to log meeting');
  await mutate(OAC_KEY);
  return res.json();
}
export async function toggleAction(id: string, is_completed: boolean) {
  const res = await fetch('/api/franchise/action-items', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, is_completed }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed to update action');
  await mutate(OAC_KEY);
  return res.json();
}

/* ── Remote verification hub ───────────────────────────────────────── */
const VERIFY_KEY = '/api/franchise/verifications';
export function useVerifications() {
  const { data, error, isLoading, mutate: revalidate } = useSWR<{ verifications?: any[] }>(VERIFY_KEY, fetcher, opts);
  return { verifications: data?.verifications ?? [], loading: isLoading, error, revalidate };
}
export async function createVerification(payload: Record<string, any>) {
  const res = await fetch(VERIFY_KEY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed to request verification');
  await mutate(VERIFY_KEY);
  return res.json();
}
export async function decideVerification(id: string, status: 'verified' | 'rejected' | 'pending', verified_by?: string, evidence_note?: string) {
  const res = await fetch(VERIFY_KEY, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status, verified_by, evidence_note }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed to update verification');
  await mutate(VERIFY_KEY);
  return res.json();
}

/* ── Stakeholder directory ─────────────────────────────────────────── */
const STK_KEY = '/api/franchise/stakeholders';
export function useStakeholders() {
  const { data, error, isLoading, mutate: revalidate } = useSWR<{ stakeholders?: any[] }>(STK_KEY, fetcher, opts);
  return { stakeholders: data?.stakeholders ?? [], loading: isLoading, error, revalidate };
}
export async function addStakeholder(payload: Record<string, any>) {
  const res = await fetch(STK_KEY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed to add stakeholder');
  await mutate(STK_KEY);
  return res.json();
}
export async function removeStakeholder(id: string) {
  const res = await fetch(STK_KEY, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed to remove');
  await mutate(STK_KEY);
  return res.json();
}

/* ── Phase checklists ──────────────────────────────────────────────── */
const CHK_KEY = '/api/franchise/checklist';
export function useChecklist() {
  const { data, error, isLoading, mutate: revalidate } = useSWR<{ items?: any[] }>(CHK_KEY, fetcher, opts);
  return { items: data?.items ?? [], loading: isLoading, error, revalidate };
}
export async function toggleChecklist(id: string, is_done: boolean) {
  const res = await fetch(CHK_KEY, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, is_done }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed to update checklist');
  await mutate(CHK_KEY);
  return res.json();
}

/* ── Franchisee portals ────────────────────────────────────────────── */
const PORTAL_KEY = '/api/franchise/portals';
export function usePortals() {
  const { data, error, isLoading, mutate: revalidate } = useSWR<{ portals?: any[] }>(PORTAL_KEY, fetcher, opts);
  return { portals: data?.portals ?? [], loading: isLoading, error, revalidate };
}
export async function createPortal(payload: Record<string, any>) {
  const res = await fetch(PORTAL_KEY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed to create link');
  await mutate(PORTAL_KEY);
  return res.json();
}
export async function revokePortal(id: string) {
  const res = await fetch(PORTAL_KEY, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed to revoke');
  await mutate(PORTAL_KEY);
  return res.json();
}

/* ── Daily superintendent reports ──────────────────────────────────── */
const DLOG_KEY = '/api/franchise/daily-logs';
export function useDailyLogs() {
  const { data, error, isLoading, mutate: revalidate } = useSWR<{ logs?: any[]; todayByProject?: Record<string, boolean>; lateByProject?: Record<string, boolean> }>(DLOG_KEY, fetcher, opts);
  return { logs: data?.logs ?? [], todayByProject: data?.todayByProject ?? {}, lateByProject: data?.lateByProject ?? {}, loading: isLoading, error, revalidate };
}
export async function submitDailyLog(payload: Record<string, any>) {
  const res = await fetch(DLOG_KEY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed to submit report');
  await mutate(DLOG_KEY);
  return res.json();
}

/* ── Budget + change orders ────────────────────────────────────────── */
export function useBudget() {
  const { data, error, isLoading, mutate: revalidate } = useSWR<{ budgets?: any[] }>('/api/franchise/budget', fetcher, opts);
  return { budgets: data?.budgets ?? [], loading: isLoading, error, revalidate };
}
const CO_KEY = '/api/franchise/change-orders';
export function useChangeOrders() {
  const { data, error, isLoading, mutate: revalidate } = useSWR<{ changeOrders?: any[] }>(CO_KEY, fetcher, opts);
  return { changeOrders: data?.changeOrders ?? [], loading: isLoading, error, revalidate };
}
export async function createChangeOrder(payload: Record<string, any>) {
  const res = await fetch(CO_KEY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed to create change order');
  await mutate(CO_KEY); await mutate('/api/franchise/budget');
  return res.json();
}
export async function advanceChangeOrder(id: string, action: 'advance' | 'reject', reason?: string) {
  const res = await fetch(CO_KEY, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action, reason }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed to update change order');
  await mutate(CO_KEY); await mutate('/api/franchise/budget');
  return res.json();
}

/* ── Financials (retainage / lien / TI) ────────────────────────────── */
export function useFinancials() {
  const { data, error, isLoading, mutate: revalidate } = useSWR<{ financials?: any[] }>('/api/franchise/financials', fetcher, opts);
  return { financials: data?.financials ?? [], loading: isLoading, error, revalidate };
}

/* ── Owner update email ────────────────────────────────────────────── */
export async function emailOwnerUpdate(project_id: string, to: string, text: string) {
  const res = await fetch('/api/franchise/owner-updates/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_id, to, text }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed to send email');
  return res.json();
}

/* ── Operational cycle-time KPIs ───────────────────────────────────── */
export function useOpKpis() {
  const { data, error, isLoading, mutate: revalidate } = useSWR<{ kpis?: any }>('/api/franchise/op-kpis', fetcher, opts);
  return { kpis: data?.kpis ?? {}, loading: isLoading, error, revalidate };
}

/* ── Pre-Site Inspection ───────────────────────────────────────────── */
const PRESITE_KEY = '/api/franchise/pre-site';
export function usePreSite() {
  const { data, error, isLoading, mutate: revalidate } = useSWR<{ items?: any[] }>(PRESITE_KEY, fetcher, opts);
  return { items: data?.items ?? [], loading: isLoading, error, revalidate };
}
export async function setPreSite(id: string, state: 'open' | 'passed' | 'flagged') {
  const res = await fetch(PRESITE_KEY, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, state }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed to update');
  await mutate(PRESITE_KEY);
  return res.json();
}

/* ── QC by trade ───────────────────────────────────────────────────── */
const QC_KEY = '/api/franchise/qc';
export function useQC() {
  const { data, error, isLoading, mutate: revalidate } = useSWR<{ items?: any[] }>(QC_KEY, fetcher, opts);
  return { items: data?.items ?? [], loading: isLoading, error, revalidate };
}
export async function toggleQC(id: string, is_done: boolean) {
  const res = await fetch(QC_KEY, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, is_done }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed to update QC');
  await mutate(QC_KEY);
  return res.json();
}
