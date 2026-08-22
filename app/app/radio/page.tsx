'use client';
/**
 * Saguaro Radio — web dispatch console (dispatch-lite).
 *
 * Left rail: talkgroups (project + org-wide) with monitor toggles, member
 * counts, last-traffic preview, inline New Channel form. Main: near-real-time
 * channel feed (SWR polling every 4s) — voice clips with signed audio +
 * transcript/translation (EN/ES, persisted under 'sag_lang'), amber alerts,
 * red panic rows with a Google Maps link — plus a composer (Enter sends,
 * Alert broadcasts), browser hold-to-talk PTT (MediaRecorder webm/opus,
 * feature-detected), and a hold-to-confirm PANIC that fans out push/email/SMS.
 *
 * Server layer: /api/radio/channels · /api/radio/messages · /api/radio/voice ·
 * /api/radio/panic (all proven by the radio harness). Accepts ?projectId= and
 * ?channel= search params read on mount (house pattern — no Suspense gate).
 *
 * The monitor toggle is a per-browser dispatch preference (localStorage
 * 'sag_radio_mon') layered over the server membership flag — the server flag
 * gates voice push fan-out; this controls what the console counts as watched.
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import useSWR from 'swr';
import {
  Broadcast,
  Microphone,
  Siren,
  Waveform,
  WaveformSlash,
  UsersThree,
  Plus,
  PaperPlaneRight,
  Warning,
  MapPin,
  Hash,
  ChatCircleText,
  SpeakerHigh,
} from '@phosphor-icons/react';
import {
  PremiumSurface,
  ModuleHero,
  SectionCard,
  PremiumEmpty,
  StatStrip,
  goldButtonStyle,
  goldOutlineButtonStyle,
} from '@/components/ui/premium';
import { Skeleton } from '@/components/ui/Skeleton';

/* ── Palette (dark shell: white/gold alphas only) ─────────────────────── */
const WHITE = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.62)';
const FAINT = 'rgba(255,255,255,0.42)';
const BORDER = 'rgba(255,255,255,0.08)';
const FIELD_BG = 'rgba(255,255,255,0.04)';
const FIELD_BORDER = '1px solid rgba(255,255,255,0.10)';
const GOLD = '#F59E0B';
const GOLD_HI = '#FBBF24';
const RED = '#EF4444';
const RED_SOFT = 'rgba(239,68,68,0.14)';
const RED_BORDER = 'rgba(239,68,68,0.45)';
const AMBER_SOFT = 'rgba(245,158,11,0.10)';
const AMBER_BORDER = 'rgba(245,158,11,0.40)';
const GREEN = '#45B37D';
const NEST = 'rgba(20,20,22,0.55)';

/* ── Types (mirror the server layer) ──────────────────────────────────── */
interface RadioChannel {
  id: string;
  project_id: string | null;
  name: string;
  kind: 'project' | 'custom';
  allow_subs: boolean;
  members: number;
  monitoring: boolean;
  lastMessage: { kind: string; body: string | null; sender: string | null; at: string; secs: number | null } | null;
}
interface RadioMessage {
  id: string;
  kind: 'voice' | 'text' | 'image' | 'alert' | 'panic';
  body: string | null;
  sender_name: string | null;
  sender_user_id: string | null;
  audio_url: string | null;
  audio_duration_secs: number | null;
  image_url: string | null;
  transcript: string | null;
  translations: { en?: string; es?: string } | null;
  detected_lang: string | null;
  location: { lat: number; lng: number } | null;
  created_at: string;
}

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Request failed (${r.status})`);
  return r.json();
};

const timeOf = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};
const isToday = (iso: string) => {
  const d = new Date(iso), n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};
const secsLabel = (s: number | null | undefined) => (s ? `${Math.max(1, Math.round(s))}s` : '');
const senderShort = (name: string | null) => {
  const n = (name || 'Unknown').trim();
  return n.includes('@') ? n.split('@')[0] : n;
};
const initialsOf = (name: string | null) => {
  const n = senderShort(name);
  return n.slice(0, 2).toUpperCase();
};

/* Monitor preference (per-browser dispatch board state). */
const MON_KEY = 'sag_radio_mon';
function readMonOverrides(): Record<string, boolean> {
  try { return JSON.parse(window.localStorage.getItem(MON_KEY) || '{}') || {}; } catch { return {}; }
}

export default function RadioDispatchPage() {
  /* ── URL params, read once on mount (no Suspense requirement) ───────── */
  const [ready, setReady] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [urlChannel, setUrlChannel] = useState<string | null>(null);
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      setProjectId(sp.get('projectId'));
      setUrlChannel(sp.get('channel'));
    } catch { /* no-op */ }
    setReady(true);
  }, []);

  /* ── Channels rail ──────────────────────────────────────────────────── */
  const channelsKey = ready
    ? (projectId ? `/api/radio/channels?projectId=${encodeURIComponent(projectId)}` : '/api/radio/channels')
    : null;
  const { data: chData, error: chError, mutate: mutateChannels } = useSWR<{ channels: RadioChannel[] }>(
    channelsKey, fetcher,
    { refreshInterval: 20_000, revalidateOnFocus: true, keepPreviousData: true },
  );
  const channels = chData?.channels ?? [];

  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => {
    if (activeId || channels.length === 0) return;
    const fromUrl = urlChannel && channels.find((c) => c.id === urlChannel);
    const allHands = channels.find((c) => c.kind === 'project');
    setActiveId((fromUrl || allHands || channels[0]).id);
  }, [channels, activeId, urlChannel]);
  const active = channels.find((c) => c.id === activeId) || null;

  /* Monitor toggles — server flag merged with the local dispatch pref. */
  const [monOverrides, setMonOverrides] = useState<Record<string, boolean>>({});
  useEffect(() => { setMonOverrides(readMonOverrides()); }, []);
  const isMonitored = useCallback(
    (c: RadioChannel) => (monOverrides[c.id] !== undefined ? monOverrides[c.id] : c.monitoring !== false),
    [monOverrides],
  );
  const toggleMonitor = (c: RadioChannel) => {
    setMonOverrides((prev) => {
      const next = { ...prev, [c.id]: !isMonitored(c) };
      try { window.localStorage.setItem(MON_KEY, JSON.stringify(next)); } catch { /* best-effort */ }
      return next;
    });
  };

  /* ── New Channel inline form ────────────────────────────────────────── */
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAllowSubs, setNewAllowSubs] = useState(false);
  const [creating, setCreating] = useState(false);
  const createChannel = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const r = await fetch('/api/radio/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, projectId: projectId || undefined, allowSubs: newAllowSubs }),
      });
      if (r.ok) {
        const j = await r.json();
        setNewName(''); setNewAllowSubs(false); setShowNew(false);
        await mutateChannels();
        if (j?.channel?.id) setActiveId(j.channel.id);
      }
    } catch { /* surfaced by the rail staying unchanged */ }
    setCreating(false);
  };

  /* ── Feed (poll every 4s while open) ────────────────────────────────── */
  const messagesKey = activeId ? `/api/radio/messages?channelId=${encodeURIComponent(activeId)}` : null;
  const { data: msgData, error: msgError, mutate: mutateMessages } = useSWR<{ messages: RadioMessage[] }>(
    messagesKey, fetcher,
    { refreshInterval: 4000, revalidateOnFocus: true, keepPreviousData: false, dedupingInterval: 1500 },
  );
  const messages = msgData?.messages ?? [];

  const feedRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, activeId]);

  /* ── Language (EN/ES) — persisted under 'sag_lang' ──────────────────── */
  const [lang, setLang] = useState<'en' | 'es'>('en');
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('sag_lang');
      if (saved === 'es' || saved === 'en') setLang(saved);
    } catch { /* no-op */ }
  }, []);
  const pickLang = (l: 'en' | 'es') => {
    setLang(l);
    try { window.localStorage.setItem('sag_lang', l); } catch { /* best-effort */ }
  };

  /* ── Composer ───────────────────────────────────────────────────────── */
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const sendText = async (kind: 'text' | 'alert') => {
    const body = draft.trim();
    if (!body || !activeId || sending) return;
    setSending(true);
    try {
      const r = await fetch('/api/radio/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: activeId, kind, body }),
      });
      if (r.ok) { setDraft(''); await mutateMessages(); }
    } catch { /* keep the draft so nothing is lost */ }
    setSending(false);
  };

  /* ── Browser PTT (MediaRecorder, feature-detected) ──────────────────── */
  const [pttSupported, setPttSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recStartRef = useRef(0);
  useEffect(() => {
    setPttSupported(
      typeof window !== 'undefined' &&
      typeof (window as any).MediaRecorder !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia,
    );
  }, []);

  const pttStart = async () => {
    if (!pttSupported || recording || !activeId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(
        (m) => (window as any).MediaRecorder?.isTypeSupported?.(m),
      );
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const durationSecs = (Date.now() - recStartRef.current) / 1000;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        chunksRef.current = [];
        if (durationSecs < 0.5 || blob.size === 0 || !activeId) return;
        const ext = (rec.mimeType || '').includes('mp4') ? 'mp4' : 'webm';
        const fd = new FormData();
        fd.append('channelId', activeId);
        fd.append('durationSecs', String(Math.round(durationSecs * 10) / 10));
        fd.append('file', new File([blob], `ptt.${ext}`, { type: blob.type }));
        setUploadingVoice(true);
        try {
          const r = await fetch('/api/radio/voice', { method: 'POST', body: fd });
          if (r.ok) await mutateMessages();
        } catch { /* clip dropped — dispatcher re-keys */ }
        setUploadingVoice(false);
      };
      recRef.current = rec;
      recStartRef.current = Date.now();
      rec.start();
      setRecording(true);
    } catch {
      // Mic denied or unavailable — hide the key gracefully.
      setPttSupported(false);
    }
  };
  const pttStop = () => {
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop();
    recRef.current = null;
    setRecording(false);
  };
  useEffect(() => () => { if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop(); }, []);

  /* ── PANIC (hold-to-confirm, best-effort geolocation) ───────────────── */
  const PANIC_HOLD_MS = 1500;
  const [panicHold, setPanicHold] = useState(0); // 0..1
  const [panicSent, setPanicSent] = useState(false);
  const [panicFiring, setPanicFiring] = useState(false);
  const panicTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const panicFiredRef = useRef(false);

  const firePanic = async () => {
    if (panicFiring) return;
    setPanicFiring(true);
    const location = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      const to = setTimeout(() => resolve(null), 2500);
      navigator.geolocation.getCurrentPosition(
        (pos) => { clearTimeout(to); resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
        () => { clearTimeout(to); resolve(null); },
        { enableHighAccuracy: false, timeout: 2000, maximumAge: 60_000 },
      );
    });
    try {
      const payload: Record<string, unknown> = location ? { location } : {};
      if (activeId) payload.channelId = activeId; else if (projectId) payload.projectId = projectId;
      const r = await fetch('/api/radio/panic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        setPanicSent(true);
        setTimeout(() => setPanicSent(false), 6000);
        await mutateMessages();
      }
    } catch { /* panic row absence tells the dispatcher to retry */ }
    setPanicFiring(false);
  };
  const panicDown = () => {
    if (panicFiring) return;
    panicFiredRef.current = false;
    const started = Date.now();
    panicTimerRef.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - started) / PANIC_HOLD_MS);
      setPanicHold(p);
      if (p >= 1 && !panicFiredRef.current) {
        panicFiredRef.current = true;
        if (panicTimerRef.current) clearInterval(panicTimerRef.current);
        setPanicHold(0);
        firePanic();
      }
    }, 50);
  };
  const panicUp = () => {
    if (panicTimerRef.current) clearInterval(panicTimerRef.current);
    panicTimerRef.current = null;
    setPanicHold(0);
  };
  useEffect(() => () => { if (panicTimerRef.current) clearInterval(panicTimerRef.current); }, []);

  /* ── Stats ──────────────────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const reachable = channels.reduce((max, c) => Math.max(max, Number(c.members) || 0), 0);
    const monitored = channels.filter((c) => isMonitored(c)).length;
    const trafficToday = messages.filter((m) => isToday(m.created_at)).length;
    return { channels: channels.length, reachable, monitored, trafficToday };
  }, [channels, messages, isMonitored]);

  const firstLoad = !chData && !chError;

  /* ── Render helpers ─────────────────────────────────────────────────── */
  const renderTranscript = (m: RadioMessage) => {
    const translated = m.translations?.[lang];
    const base = m.transcript || null;
    const text = translated || base;
    if (!text) return null;
    return (
      <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5, marginTop: 6, fontStyle: translated ? 'normal' : 'italic' }}>
        {translated && m.detected_lang && m.detected_lang !== lang && (
          <span style={{ color: FAINT, fontWeight: 800, fontSize: 10, letterSpacing: '0.08em', marginRight: 6 }}>
            {lang.toUpperCase()}
          </span>
        )}
        {text}
      </div>
    );
  };

  const renderRow = (m: RadioMessage) => {
    const panic = m.kind === 'panic';
    const alert = m.kind === 'alert';
    const rowBg = panic ? RED_SOFT : alert ? AMBER_SOFT : 'transparent';
    const rowBorder = panic ? `1px solid ${RED_BORDER}` : alert ? `1px solid ${AMBER_BORDER}` : `1px solid ${BORDER}`;
    const translatedBody = m.translations?.[lang];
    return (
      <div
        key={m.id}
        style={{
          display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 12,
          background: rowBg, border: rowBorder, marginBottom: 8,
        }}
      >
        <span
          aria-hidden
          style={{
            flexShrink: 0, width: 34, height: 34, borderRadius: 10,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: panic ? RED_SOFT : 'rgba(245,158,11,0.12)',
            border: panic ? `1px solid ${RED_BORDER}` : '1px solid rgba(245,158,11,0.30)',
            color: panic ? RED : GOLD_HI, fontSize: 11.5, fontWeight: 900,
          }}
        >
          {panic ? <Siren size={16} weight="fill" /> : alert ? <Warning size={16} weight="fill" /> : m.kind === 'voice' ? <SpeakerHigh size={15} weight="fill" /> : initialsOf(m.sender_name)}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: panic ? RED : alert ? GOLD_HI : WHITE }}>
              {senderShort(m.sender_name)}
            </span>
            {panic && (
              <span style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: '0.12em', color: RED, border: `1px solid ${RED_BORDER}`, borderRadius: 999, padding: '1px 7px' }}>
                PANIC
              </span>
            )}
            {alert && (
              <span style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: '0.12em', color: GOLD_HI, border: `1px solid ${AMBER_BORDER}`, borderRadius: 999, padding: '1px 7px' }}>
                ALERT
              </span>
            )}
            {m.kind === 'voice' && m.audio_duration_secs != null && (
              <span style={{ fontSize: 11, color: FAINT, fontVariantNumeric: 'tabular-nums' }}>{secsLabel(m.audio_duration_secs)}</span>
            )}
            <span style={{ fontSize: 11, color: FAINT, marginLeft: 'auto', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
              {timeOf(m.created_at)}
            </span>
          </div>

          {m.kind === 'voice' && m.audio_url && (
            <audio controls preload="none" src={m.audio_url} style={{ width: '100%', maxWidth: 380, height: 36, marginTop: 8, display: 'block' }} />
          )}
          {m.kind === 'voice' && renderTranscript(m)}

          {m.kind === 'image' && m.image_url && (
            <a href={m.image_url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 8 }}>
              <img src={m.image_url} alt="Radio photo" style={{ maxWidth: 260, maxHeight: 200, borderRadius: 10, border: `1px solid ${BORDER}`, display: 'block' }} />
            </a>
          )}

          {m.kind !== 'voice' && m.body && (
            <div style={{ fontSize: 13.5, color: panic ? '#FCA5A5' : WHITE, lineHeight: 1.55, marginTop: 4, overflowWrap: 'anywhere' }}>
              {m.body}
            </div>
          )}
          {m.kind !== 'voice' && translatedBody && translatedBody !== m.body && (
            <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5, marginTop: 4 }}>
              <span style={{ color: FAINT, fontWeight: 800, fontSize: 10, letterSpacing: '0.08em', marginRight: 6 }}>{lang.toUpperCase()}</span>
              {translatedBody}
            </div>
          )}

          {panic && m.location && typeof m.location.lat === 'number' && (
            <a
              href={`https://maps.google.com/?q=${m.location.lat},${m.location.lng}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8,
                padding: '5px 12px', borderRadius: 999, textDecoration: 'none',
                background: RED_SOFT, border: `1px solid ${RED_BORDER}`,
                color: '#FCA5A5', fontSize: 11.5, fontWeight: 800,
              }}
            >
              <MapPin size={13} weight="fill" /> Open location in Google Maps
            </a>
          )}
        </div>
      </div>
    );
  };

  const railRow = (c: RadioChannel) => {
    const isActive = c.id === activeId;
    const mon = isMonitored(c);
    const lm = c.lastMessage;
    const preview = lm
      ? lm.kind === 'voice' ? `PTT ${secsLabel(lm.secs)}`
        : lm.kind === 'panic' ? 'PANIC ALARM'
        : lm.kind === 'image' ? 'Photo'
        : (lm.body || '').slice(0, 46)
      : 'No traffic yet';
    return (
      <div
        key={c.id}
        onClick={() => setActiveId(c.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') setActiveId(c.id); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
          borderRadius: 12, cursor: 'pointer', marginBottom: 4,
          background: isActive ? 'linear-gradient(180deg, rgba(245,158,11,0.16), rgba(245,158,11,0.06))' : 'transparent',
          border: isActive ? `1px solid ${AMBER_BORDER}` : '1px solid transparent',
        }}
      >
        <span
          aria-hidden
          style={{
            flexShrink: 0, width: 30, height: 30, borderRadius: 9,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: isActive ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.05)',
            border: isActive ? '1px solid rgba(245,158,11,0.35)' : `1px solid ${BORDER}`,
            color: isActive ? GOLD_HI : MUTED,
          }}
        >
          <Hash size={14} weight="bold" />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: isActive ? GOLD_HI : WHITE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {c.name}
            </span>
            {lm?.kind === 'panic' && <Siren size={12} weight="fill" color={RED} style={{ flexShrink: 0 }} />}
          </div>
          <div style={{ fontSize: 11, color: FAINT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
            <UsersThree size={11} weight="bold" style={{ verticalAlign: '-1px', marginRight: 4 }} />
            {c.members} · {preview}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); toggleMonitor(c); }}
          title={mon ? 'Monitoring — click to mute on this board' : 'Muted on this board — click to monitor'}
          aria-label={mon ? `Stop monitoring ${c.name}` : `Monitor ${c.name}`}
          style={{
            flexShrink: 0, width: 26, height: 26, borderRadius: 8, padding: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: mon ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.04)',
            border: mon ? '1px solid rgba(245,158,11,0.40)' : `1px solid ${BORDER}`,
            color: mon ? GOLD_HI : FAINT, cursor: 'pointer',
          }}
        >
          {mon ? <Waveform size={13} weight="bold" /> : <WaveformSlash size={13} weight="bold" />}
        </button>
      </div>
    );
  };

  /* ── Page ───────────────────────────────────────────────────────────── */
  return (
    <PremiumSurface maxWidth={1500}>
      <ModuleHero
        eyebrow="Saguaro Radio"
        eyebrowIcon={<Broadcast size={13} weight="bold" />}
        title="Dispatch"
        accent="Radio"
        subtitle="Live talkgroups across the field — push-to-talk traffic, transcripts in English and Spanish, alerts, and a panic fan-out that reaches every member in seconds."
        actions={
          <>
            {/* EN/ES transcript language toggle */}
            <div style={{ display: 'inline-flex', borderRadius: 10, overflow: 'hidden', border: FIELD_BORDER }}>
              {(['en', 'es'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => pickLang(l)}
                  style={{
                    padding: '8px 14px', border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 800, letterSpacing: '0.06em',
                    background: lang === l ? 'linear-gradient(180deg, rgba(245,158,11,0.30), rgba(245,158,11,0.14))' : FIELD_BG,
                    color: lang === l ? GOLD_HI : MUTED,
                  }}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            {/* PANIC — hold to confirm */}
            <button
              onPointerDown={panicDown}
              onPointerUp={panicUp}
              onPointerLeave={panicUp}
              onPointerCancel={panicUp}
              disabled={panicFiring}
              title="Hold to send a panic alarm to every channel member"
              style={{
                position: 'relative', overflow: 'hidden',
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '11px 20px', borderRadius: 12, cursor: panicFiring ? 'wait' : 'pointer',
                background: panicSent ? 'rgba(69,179,125,0.15)' : RED_SOFT,
                border: `1px solid ${panicSent ? 'rgba(69,179,125,0.5)' : RED_BORDER}`,
                color: panicSent ? GREEN : RED, fontWeight: 900, fontSize: 13, letterSpacing: '0.05em',
                userSelect: 'none', touchAction: 'none',
              }}
            >
              <span
                aria-hidden
                style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${panicHold * 100}%`,
                  background: 'rgba(239,68,68,0.35)',
                  transition: panicHold === 0 ? 'width .2s ease' : 'none',
                }}
              />
              <Siren size={16} weight="fill" style={{ position: 'relative' }} />
              <span style={{ position: 'relative' }}>
                {panicFiring ? 'SENDING…' : panicSent ? 'PANIC SENT' : 'HOLD — PANIC'}
              </span>
            </button>
          </>
        }
      />

      {/* StatStrip — what the console already knows */}
      {firstLoad ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={64} borderRadius={14} />)}
        </div>
      ) : (
        <StatStrip
          items={[
            { label: 'Talkgroups', value: stats.channels, icon: <Broadcast size={12} weight="bold" /> },
            { label: 'Members reachable', value: stats.reachable, sub: 'widest talkgroup', icon: <UsersThree size={12} weight="bold" /> },
            { label: 'Traffic today', value: stats.trafficToday, sub: active ? active.name : undefined, icon: <ChatCircleText size={12} weight="bold" /> },
            { label: 'Monitoring', value: `${stats.monitored}/${stats.channels}`, accent: stats.monitored > 0 ? GOLD_HI : undefined, icon: <Waveform size={12} weight="bold" /> },
          ]}
        />
      )}

      {/* Rail + feed */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 300px) 1fr', gap: 16, alignItems: 'start' }}>
        {/* ── Channel rail ─────────────────────────────────────────────── */}
        <SectionCard
          title="Channels"
          icon={<Broadcast size={16} weight="bold" color={GOLD_HI} />}
          action={
            <button
              onClick={() => setShowNew((v) => !v)}
              style={{ ...goldOutlineButtonStyle, padding: '6px 12px', fontSize: 12 }}
            >
              <Plus size={13} weight="bold" /> New
            </button>
          }
          flush
        >
          <div style={{ padding: 10 }}>
            {showNew && (
              <div style={{ padding: 10, marginBottom: 8, borderRadius: 12, background: NEST, border: `1px solid ${BORDER}` }}>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') createChannel(); }}
                  placeholder="Channel name (e.g. Concrete crew)"
                  autoFocus
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                    background: FIELD_BG, border: FIELD_BORDER, borderRadius: 10,
                    color: WHITE, fontSize: 13, outline: 'none', marginBottom: 8,
                  }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: MUTED, cursor: 'pointer', marginBottom: 10 }}>
                  <input type="checkbox" checked={newAllowSubs} onChange={(e) => setNewAllowSubs(e.target.checked)} style={{ accentColor: GOLD }} />
                  Subs can join this channel
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={createChannel}
                    disabled={!newName.trim() || creating}
                    className="pmBtn"
                    style={{ ...goldButtonStyle, padding: '8px 14px', fontSize: 12.5, opacity: !newName.trim() || creating ? 0.6 : 1 }}
                  >
                    {creating ? 'Creating…' : 'Create channel'}
                  </button>
                  <button
                    onClick={() => setShowNew(false)}
                    style={{ background: 'none', border: 'none', color: FAINT, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {firstLoad && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 4 }}>
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={44} borderRadius={12} />)}
              </div>
            )}
            {!firstLoad && chError && !channels.length && (
              <PremiumEmpty compact tone="error" icon={<Warning size={26} color={RED} weight="fill" />} title="Radio unreachable" description="Could not load your talkgroups. Check your connection and try again." />
            )}
            {!firstLoad && !chError && channels.length === 0 && (
              <PremiumEmpty compact icon={<Broadcast size={26} color={GOLD_HI} weight="fill" />} title="No channels yet" description={projectId ? 'Open a project to auto-create its All Hands talkgroup, or start a custom channel.' : 'Start a custom channel, or open Radio from a project to spin up its All Hands talkgroup.'} />
            )}
            {channels.map(railRow)}
          </div>
        </SectionCard>

        {/* ── Feed ─────────────────────────────────────────────────────── */}
        <SectionCard
          title={active ? active.name : 'Channel'}
          subtitle={active ? `${active.members} member${active.members === 1 ? '' : 's'}${active.allow_subs ? ' · subs allowed' : ''}${active.kind === 'project' ? ' · project talkgroup' : ''}` : undefined}
          icon={<Hash size={16} weight="bold" color={GOLD_HI} />}
          flush
        >
          <div style={{ display: 'flex', flexDirection: 'column', height: 'min(680px, calc(100vh - 330px))', minHeight: 440 }}>
            {/* Traffic */}
            <div ref={feedRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 6px' }}>
              {!active && firstLoad && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={58} borderRadius={12} />)}
                </div>
              )}
              {active && !msgData && !msgError && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={58} borderRadius={12} />)}
                </div>
              )}
              {active && msgError && (
                <PremiumEmpty tone="error" icon={<Warning size={30} color={RED} weight="fill" />} title="Feed unavailable" description="Could not load this channel's traffic. The console retries automatically every few seconds." />
              )}
              {active && msgData && messages.length === 0 && (
                <PremiumEmpty icon={<Microphone size={30} color={GOLD_HI} weight="fill" />} title="Channel is quiet" description="No traffic yet. Key up with hold-to-talk below, or send the first text — every monitoring member hears about it." />
              )}
              {messages.map(renderRow)}
            </div>

            {/* Composer */}
            <div style={{ borderTop: `1px solid ${BORDER}`, padding: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              {pttSupported && (
                <button
                  onPointerDown={pttStart}
                  onPointerUp={pttStop}
                  onPointerLeave={pttStop}
                  onPointerCancel={pttStop}
                  disabled={!active || uploadingVoice}
                  title="Hold to talk — release to transmit"
                  aria-label="Hold to talk"
                  style={{
                    flexShrink: 0, width: 46, height: 42, borderRadius: 12, padding: 0,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    cursor: active ? 'pointer' : 'not-allowed',
                    background: recording
                      ? `linear-gradient(180deg, ${RED}, #B91C1C)`
                      : `linear-gradient(180deg, ${GOLD_HI}, ${GOLD} 60%, var(--brand-primary-hover))`,
                    border: 'none', color: recording ? WHITE : '#241500',
                    boxShadow: recording ? '0 0 0 4px rgba(239,68,68,0.25)' : '0 4px 14px var(--brand-primary-25)',
                    userSelect: 'none', touchAction: 'none',
                    opacity: !active || uploadingVoice ? 0.55 : 1,
                  }}
                >
                  {uploadingVoice ? <Waveform size={18} weight="bold" /> : <Microphone size={18} weight="fill" />}
                </button>
              )}
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText('text'); } }}
                placeholder={recording ? 'Transmitting… release to send' : active ? `Message ${active.name}` : 'Select a channel'}
                disabled={!active || sending}
                style={{
                  flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '11px 14px',
                  background: FIELD_BG, border: FIELD_BORDER, borderRadius: 12,
                  color: WHITE, fontSize: 13.5, outline: 'none',
                }}
              />
              <button
                onClick={() => sendText('alert')}
                disabled={!active || !draft.trim() || sending}
                title="Broadcast as a high-visibility alert (notifies every member)"
                style={{
                  flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
                  background: AMBER_SOFT, border: `1px solid ${AMBER_BORDER}`,
                  color: GOLD_HI, fontWeight: 800, fontSize: 12.5,
                  opacity: !active || !draft.trim() || sending ? 0.5 : 1,
                }}
              >
                <Warning size={14} weight="fill" /> Alert
              </button>
              <button
                onClick={() => sendText('text')}
                disabled={!active || !draft.trim() || sending}
                className="pmBtn"
                aria-label="Send message"
                style={{ ...goldButtonStyle, padding: '10px 16px', opacity: !active || !draft.trim() || sending ? 0.5 : 1 }}
              >
                <PaperPlaneRight size={15} weight="fill" />
              </button>
            </div>
          </div>
        </SectionCard>
      </div>
    </PremiumSurface>
  );
}
