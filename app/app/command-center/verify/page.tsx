'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useProjects } from '@/lib/hooks/useProjects';
import { useVerifications, createVerification, decideVerification } from '@/lib/hooks/useFranchise';
import { ROLLOUT_STAGES, STAGE_META } from '@/lib/franchise-template';
import {
  C, font, fmtDate, useFranchiseGate, GateLoading, PageHeader, Tile, Chip, SearchInput, EmptyState,
} from '@/components/franchise/kit';
import { VideoCamera, MapPin, Camera, CheckCircle, XCircle, AirplaneTilt, Globe, House, FilmSlate, Phone, LinkSimple } from '@phosphor-icons/react';

type VStatus = 'pending' | 'verified' | 'rejected';
const STATUS_COLOR: Record<VStatus, string> = { pending: C.gold, verified: C.green, rejected: C.red };
const STATUS_LABEL: Record<VStatus, string> = { pending: 'Pending', verified: 'Verified', rejected: 'Rejected' };

// Verification methods — remote evidence types plus a physical on-site visit.
const METHOD_META: Record<string, { label: string; linkLabel: string }> = {
  photo:      { label: 'Photo',            linkLabel: 'Evidence photo URL' },
  drone:      { label: 'Drone',            linkLabel: 'Drone footage URL' },
  '360':      { label: '360° Walkthrough', linkLabel: '360° walkthrough URL' },
  matterport: { label: 'Matterport',       linkLabel: 'Matterport scan URL' },
  facetime:   { label: 'Live Video',       linkLabel: 'Video-call / FaceTime link' },
  video:      { label: 'Video',            linkLabel: 'Video URL' },
  site_visit: { label: 'On-Site Visit',    linkLabel: 'Scheduling / calendar link' },
};
const METHOD_ICON: Record<string, React.ComponentType<any>> = {
  photo: Camera, drone: AirplaneTilt, '360': Globe, matterport: House, facetime: VideoCamera, video: FilmSlate, site_visit: MapPin,
};
const METHOD_OPTIONS = Object.keys(METHOD_META);

export default function VerifyHubPage() {
  const { ready, loading: gateLoading } = useFranchiseGate();
  const { verifications, loading } = useVerifications();
  const { projects } = useProjects();
  const [filter, setFilter] = useState<'all' | VStatus>('pending');
  const [q, setQ] = useState('');
  const [requesting, setRequesting] = useState<false | { method: string }>(false);
  const [walkthrough, setWalkthrough] = useState(false);
  const [override, setOverride] = useState<Record<string, VStatus>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const statusOf = (v: any): VStatus => (override[v.id] as VStatus) || (['pending', 'verified', 'rejected'].includes(v.status) ? v.status : 'pending');

  const summary = useMemo(() => {
    const s = { pending: 0, verified: 0, rejected: 0, sites: new Set<string>() };
    (verifications as any[]).forEach((v) => { s[statusOf(v)]++; if (v.project_id) s.sites.add(v.project_id); });
    return { ...s, sites: s.sites.size, total: (verifications as any[]).length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifications, override]);

  const filtered = (verifications as any[]).filter((v) =>
    (filter === 'all' || statusOf(v) === filter) &&
    (!q || `${v.title || ''} ${v.project_name || ''} ${v.requested_by || ''}`.toLowerCase().includes(q.toLowerCase())));

  async function decide(v: any, status: VStatus) {
    if (busy[v.id]) return;
    setOverride((o) => ({ ...o, [v.id]: status }));
    setBusy((b) => ({ ...b, [v.id]: true }));
    try { await decideVerification(v.id, status); }
    catch { setOverride((o) => { const n = { ...o }; delete n[v.id]; return n; }); }
    finally { setBusy((b) => ({ ...b, [v.id]: false })); }
  }

  if (gateLoading) return <GateLoading />;
  if (!ready) return null;

  return (
    <div style={{ padding: '28px 24px 60px', maxWidth: 1200, margin: '0 auto', fontFamily: font, color: C.text }}>
      <PageHeader
        title="Remote Verification Hub"
        subtitle="Sign off on site milestones from anywhere — photos, drone, 360°, Matterport, live video, or a physical on-site visit when one is required."
        right={<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button onClick={() => setWalkthrough(true)} style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${C.blue}`, background: '#141416', color: C.blue, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><VideoCamera size={15} weight="regular" color={C.blue} /></span> Start Live Walkthrough</button>
          <button onClick={() => setRequesting({ method: 'site_visit' })} style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: '#141416', color: C.text, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><MapPin size={15} weight="regular" color={C.text} /></span> Request On-Site Visit</button>
          <button onClick={() => setRequesting({ method: 'photo' })} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: C.gold, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>+ Request Verification</button>
        </div>}
      />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <Tile label="Pending" value={summary.pending} color={summary.pending ? C.gold : C.green} />
        <Tile label="Verified" value={summary.verified} color={C.green} />
        <Tile label="Rejected" value={summary.rejected} color={summary.rejected ? C.red : C.dim} />
        <Tile label="Sites" value={summary.sites} />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        {(['pending', 'verified', 'rejected', 'all'] as const).map((f) => (
          <Chip key={f} active={filter === f} color={f === 'all' ? C.text : STATUS_COLOR[f as VStatus]}
            onClick={() => setFilter(f)} count={f === 'all' ? summary.total : (summary as any)[f]}>
            {f === 'all' ? 'All' : STATUS_LABEL[f as VStatus]}
          </Chip>
        ))}
        <SearchInput value={q} onChange={setQ} placeholder="Search item, site…" />
      </div>

      {loading ? (
        <div style={{ color: C.dim, padding: 40, textAlign: 'center' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        (verifications as any[]).length === 0 ? (
          <EmptyState icon={<Camera size={34} weight="regular" color={C.dim} />} title="No verifications yet"
            body="Request a remote sign-off on a milestone — the field uploads evidence, you review and verify from anywhere before the site advances a stage."
            action={<button onClick={() => setRequesting({ method: 'photo' })} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: C.gold, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>+ Request your first</button>} />
        ) : <EmptyState title="Nothing matches this filter" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
          {filtered.map((v) => {
            const st = statusOf(v);
            const stage = v.stage ? STAGE_META[v.stage] : null;
            return (
              <div key={v.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `4px solid ${STATUS_COLOR[st]}`, borderRadius: 14, padding: '15px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>{v.title}</div>
                    <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>
                      {v.project_id ? <Link href={`/app/projects/${v.project_id}`} style={{ color: C.blue, textDecoration: 'none' }}>{v.project_name || 'Site'}</Link> : 'Site'}
                      {v.project_city ? ` · ${v.project_city}, ${v.project_state}` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: STATUS_COLOR[st], background: `${STATUS_COLOR[st]}14`, padding: '4px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>{STATUS_LABEL[st]}</span>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
                  {v.method && METHOD_META[v.method] && (() => { const MI = METHOD_ICON[v.method]; return <span style={{ fontSize: 11, fontWeight: 700, color: C.text, background: '#1c1c1e', padding: '3px 9px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>{MI && <MI size={12} weight="regular" color={C.text} />}{METHOD_META[v.method].label}</span>; })()}
                  {stage && <span style={{ fontSize: 11, fontWeight: 700, color: stage.color, background: `${stage.color}18`, padding: '3px 9px', borderRadius: 6 }}>Gate: {stage.label}</span>}
                  {v.requested_by && <span style={{ fontSize: 11, color: C.dim, padding: '3px 0' }}>Requested by {v.requested_by}</span>}
                </div>

                {v.evidence_note && <div style={{ fontSize: 13, color: C.dim, marginTop: 10, lineHeight: 1.5 }}>{v.evidence_note}</div>}
                {v.media_url && (() => { const MI = METHOD_ICON[v.method] || LinkSimple; return <a href={v.media_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: C.blue, marginTop: 8, textDecoration: 'none' }}><MI size={13} weight="regular" color={C.blue} /> View {METHOD_META[v.method]?.label?.toLowerCase() || 'evidence'}</a>; })()}
                {v.photo_url && <a href={v.photo_url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, color: C.blue, marginTop: 8, marginLeft: v.media_url ? 12 : 0, textDecoration: 'none' }}><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><Camera size={14} weight="regular" color={C.blue} /></span> View evidence photo</a>}

                {st === 'pending' ? (
                  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    <button onClick={() => decide(v, 'verified')} disabled={busy[v.id]} style={{ flex: 1, padding: '8px', borderRadius: 9, border: 'none', background: C.green, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><CheckCircle size={15} weight="regular" color="#fff" /></span> Verify</button>
                    <button onClick={() => decide(v, 'rejected')} disabled={busy[v.id]} style={{ flex: 1, padding: '8px', borderRadius: 9, border: `1px solid ${C.red}`, background: '#141416', color: C.red, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><XCircle size={15} weight="regular" color={C.red} /></span> Reject</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 12, color: C.dim }}>
                    <span>{st === 'verified' ? <><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><CheckCircle size={14} weight="fill" color={C.dim} /></span> Verified</> : <><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><XCircle size={14} weight="fill" color={C.dim} /></span> Rejected</>}{v.verified_by ? ` by ${v.verified_by}` : ''}{v.verified_at ? ` · ${fmtDate(v.verified_at)}` : ''}</span>
                    <button onClick={() => decide(v, 'pending')} disabled={busy[v.id]} style={{ fontSize: 11, fontWeight: 700, color: C.blue, background: 'none', border: 'none', cursor: 'pointer' }}>Reopen</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {requesting && <RequestModal projects={projects} initialMethod={requesting.method} onClose={() => setRequesting(false)} />}
      {walkthrough && <LiveWalkthroughModal projects={projects} onClose={() => setWalkthrough(false)} />}
    </div>
  );
}

// One-tap live-video walkthrough: deep-links into Google Meet / Zoom / FaceTime
// (no external account or spend on our side — it launches the native call), then
// logs the session as a verification record so the walkthrough is on the books.
function LiveWalkthroughModal({ projects, onClose }: { projects: any[]; onClose: () => void }) {
  const [f, setF] = useState<Record<string, any>>({ platform: 'meet' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const inp: React.CSSProperties = { padding: '9px 11px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', background: '#1c1c1e', width: '100%' };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4, display: 'block' };

  const PLATFORMS: Record<string, { label: string; instant: boolean; url?: string }> = {
    meet:     { label: 'Google Meet (new instant meeting)', instant: true, url: 'https://meet.google.com/new' },
    zoom:     { label: 'Zoom (start instant meeting)',      instant: true, url: 'https://zoom.us/start/videomeeting' },
    facetime: { label: 'FaceTime (call an address)',        instant: false },
    custom:   { label: 'Paste a meeting link',              instant: false },
  };
  const PLATFORM_ICON: Record<string, React.ComponentType<any>> = { meet: VideoCamera, zoom: VideoCamera, facetime: Phone, custom: LinkSimple };
  const p = PLATFORMS[f.platform] || PLATFORMS.meet;
  const PIcon = PLATFORM_ICON[f.platform] || VideoCamera;

  function launchUrl(): string {
    if (f.platform === 'facetime') return f.address ? `facetime://${encodeURIComponent(String(f.address).trim())}` : '';
    if (f.platform === 'custom') return String(f.link || '').trim();
    return p.url || '';
  }

  async function launch() {
    if (!f.project_id) { setErr('Pick a site to log the walkthrough against.'); return; }
    const url = launchUrl();
    if (!url) { setErr(f.platform === 'facetime' ? 'Enter the FaceTime address to call.' : 'Enter the meeting link.'); return; }
    setBusy(true); setErr('');
    try {
      // Launch the native call in a new tab / the OS handler.
      const a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.rel = 'noreferrer';
      document.body.appendChild(a); a.click(); a.remove();
      // Log it as a verification so the walkthrough is recorded against the site.
      const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      await createVerification({
        project_id: f.project_id,
        method: f.platform === 'facetime' ? 'facetime' : 'video',
        title: f.title?.trim() || `Live walkthrough — ${today}`,
        stage: f.stage || '',
        media_url: f.platform === 'facetime' ? '' : url,
        evidence_note: `Live ${p.label.split(' (')[0]} walkthrough launched ${today}. Verify once the walk is complete.`,
        requested_by: f.requested_by || '',
      });
      onClose();
    } catch (e: any) { setErr(e?.message || 'Failed to log walkthrough'); }
    finally { setBusy(false); }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '8vh 16px', overflow: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, borderRadius: 16, padding: 24, width: 'min(540px, 100%)', boxShadow: '0 24px 80px rgba(0,0,0,0.3)', fontFamily: font }}>
        <div style={{ fontSize: 19, fontWeight: 900, marginBottom: 4 }}><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><VideoCamera size={20} weight="regular" color={C.text} /></span> Start Live Walkthrough</div>
        <p style={{ fontSize: 13, color: C.dim, margin: '0 0 16px', lineHeight: 1.5 }}>Launch a live video walkthrough with the field and log it against the site. The call opens in your video app; Saguaro records that the walkthrough happened so you can verify the milestone after.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label style={lbl}>Site *</label><select style={inp} value={f.project_id || ''} onChange={(e) => set('project_id', e.target.value)}><option value="">Select site…</option>{projects.map((pr: any) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}</select></div>
          <div><label style={lbl}>Platform</label><select style={inp} value={f.platform} onChange={(e) => set('platform', e.target.value)}>{Object.entries(PLATFORMS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
          {f.platform === 'facetime' && <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>FaceTime address (phone or Apple ID) *</label><input style={inp} placeholder="super@icloud.com or +1 480…" value={f.address || ''} onChange={(e) => set('address', e.target.value)} /></div>}
          {f.platform === 'custom' && <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Meeting link *</label><input style={inp} placeholder="https://…" value={f.link || ''} onChange={(e) => set('link', e.target.value)} /></div>}
          <div><label style={lbl}>Gates stage</label><select style={inp} value={f.stage || ''} onChange={(e) => set('stage', e.target.value)}><option value="">None</option>{ROLLOUT_STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
          <div><label style={lbl}>Requested by</label><input style={inp} value={f.requested_by || ''} onChange={(e) => set('requested_by', e.target.value)} /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>What are you walking?</label><input style={inp} placeholder="e.g. Sim bay rough-in walk" value={f.title || ''} onChange={(e) => set('title', e.target.value)} /></div>
        </div>
        {err && <div style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={launch} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 10, border: 'none', background: busy ? C.dim : C.blue, color: '#fff', fontWeight: 800, cursor: busy ? 'default' : 'pointer' }}>{busy ? 'Launching…' : <><PIcon size={15} weight="regular" color="#fff" /> Launch &amp; log</>}</button>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${C.border}`, background: '#141416', color: C.dim, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function RequestModal({ projects, initialMethod, onClose }: { projects: any[]; initialMethod: string; onClose: () => void }) {
  const [f, setF] = useState<Record<string, any>>({ method: initialMethod });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const inp: React.CSSProperties = { padding: '9px 11px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', background: '#1c1c1e', width: '100%' };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4, display: 'block' };
  const isVisit = f.method === 'site_visit';
  const mm = METHOD_META[f.method] || METHOD_META.photo;

  async function submit() {
    if (!f.project_id || !f.title) { setErr('Site and item are required.'); return; }
    setBusy(true); setErr('');
    try { await createVerification(f); onClose(); }
    catch (e: any) { setErr(e?.message || 'Failed'); }
    finally { setBusy(false); }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '8vh 16px', overflow: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, borderRadius: 16, padding: 24, width: 'min(540px, 100%)', boxShadow: '0 24px 80px rgba(0,0,0,0.3)', fontFamily: font }}>
        <div style={{ fontSize: 19, fontWeight: 900, marginBottom: 4 }}>{isVisit ? 'Request On-Site Visit' : 'Request Verification'}</div>
        <p style={{ fontSize: 13, color: C.dim, margin: '0 0 16px', lineHeight: 1.5 }}>{isVisit
          ? 'Flag a site where a physical on-site visit is required (additional fee). It lands as a pending item until the visit is completed and signed off.'
          : 'Flag a milestone for remote sign-off. Pick how it will be verified and attach the evidence link; you verify it before the site advances.'}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>{isVisit ? 'What needs an on-site look? *' : 'What needs verifying? *'}</label><input style={inp} placeholder={isVisit ? 'e.g. Punch walk before C-of-O' : 'e.g. Sim bays installed & level'} value={f.title || ''} onChange={(e) => set('title', e.target.value)} /></div>
          <div><label style={lbl}>Site *</label><select style={inp} value={f.project_id || ''} onChange={(e) => set('project_id', e.target.value)}><option value="">Select site…</option>{projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div><label style={lbl}>Method</label><select style={inp} value={f.method || 'photo'} onChange={(e) => set('method', e.target.value)}>{METHOD_OPTIONS.map((m) => <option key={m} value={m}>{METHOD_META[m].label}</option>)}</select></div>
          <div><label style={lbl}>Gates stage</label><select style={inp} value={f.stage || ''} onChange={(e) => set('stage', e.target.value)}><option value="">None</option>{ROLLOUT_STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
          <div><label style={lbl}>Requested by</label><input style={inp} value={f.requested_by || ''} onChange={(e) => set('requested_by', e.target.value)} /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>{mm.linkLabel}</label><input style={inp} placeholder="https://…" value={f.media_url || ''} onChange={(e) => set('media_url', e.target.value)} /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Note</label><textarea style={{ ...inp, minHeight: 60, resize: 'vertical', fontFamily: font }} value={f.evidence_note || ''} onChange={(e) => set('evidence_note', e.target.value)} /></div>
        </div>
        {err && <div style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={submit} disabled={busy} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: busy ? C.dim : C.gold, color: '#fff', fontWeight: 800, cursor: busy ? 'default' : 'pointer' }}>{busy ? 'Saving…' : isVisit ? 'Request visit' : 'Request verification'}</button>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${C.border}`, background: '#141416', color: C.dim, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
