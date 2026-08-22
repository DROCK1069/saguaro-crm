'use client';
/**
 * Saguaro Radio — web dispatch console v2.
 *
 * Left rail: talkgroups (project + org-wide) with monitor toggles, member
 * counts, presence ("on channel") and unread badges (v2 channel fields),
 * last-traffic preview, inline New Channel form. Main: live channel feed —
 * Supabase Realtime postgres_changes INSERT on the active channel triggers an
 * immediate SWR revalidate, with polling as the safety net (15s while the
 * socket is SUBSCRIBED, 4s otherwise) — voice clips with pseudo-waveform
 * players + transcript/translation (EN/ES, persisted under 'sag_lang'), amber
 * alerts, red panic rows with a numbered location trail, a NOW-TRANSMITTING /
 * NOW-PLAYING gold band with animated equalizer plus an analog S/RF meter
 * (needle driven by real Web Audio levels when taps are available — mic
 * AnalyserNode while keyed, media-element AnalyserNode while playing — and
 * by honest synthesized/seeded envelopes otherwise), "Catch me up"
 * sequential playback of unheard clips, and a hover "File to log" action
 * per row.
 *
 * PTT: browser hold-to-talk (MediaRecorder webm/opus, feature-detected) via
 * the mic button OR hold-SPACEBAR anywhere outside a text field (keydown keys
 * up, keyup transmits). Hold-to-confirm PANIC fans out push/email/SMS.
 *
 * Server layer: /api/radio/channels · /api/radio/messages · /api/radio/voice ·
 * /api/radio/panic · /api/radio/file-to-log. Accepts ?projectId= and ?channel=
 * search params read on mount (house pattern — no Suspense gate). Read/presence
 * piggyback (radio_members.last_seen_at/last_read_at) rides the GETs server-side.
 *
 * The monitor toggle is a per-browser dispatch preference (localStorage
 * 'sag_radio_mon') layered over the server membership flag. Heard voice clips
 * are tracked per-browser under 'sag_radio_heard' (capped at 500 ids).
 *
 * Tier-1 dispatch controls: assistance queue (SWR 10s; one-click ack /
 * resolve w/ header badge), channel roster w/ call signs + presence (GET
 * ?roster= / POST profile), patch board (two-channel bridge w/ release;
 * mirrored rows tagged 'via <channel>'), priority-channel star, tone
 * signaling (ACK / NEG / COME IN — WebAudio beeps at distinct frequencies),
 * and the recording console (date range + search + print-ready record).
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import useSWR from 'swr';
import type { RealtimeChannel } from '@supabase/supabase-js';
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
  Play,
  Pause,
  FastForward,
  ClipboardText,
  Check,
  Paperclip,
  ShareNetwork,
  Copy,
  Trash,
  X,
  MapTrifold,
  CaretDown,
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
import { SMeter } from '@/components/ui/SMeter';
import { CrewMap, type CrewPin, type HeatBin } from '@/components/ui/CrewMap';
import { HAS_SUPABASE, getSupabaseBrowser, ensureBrowserSession, getSession } from '@/lib/supabase-browser';
/* Tier-1 dispatch console additions (separate import statement so the block
 * above stays byte-stable for parallel workstreams). */
import {
  Star,
  Printer,
  PlugsConnected,
  Lifebuoy,
  BellRinging,
  ClockCounterClockwise,
  MagnifyingGlass,
  PencilSimple,
  CaretUp,
  DotsThree,
  Megaphone,
  Lock,
  LockOpen,
  UserPlus,
} from '@phosphor-icons/react';
import SaguaroDatePicker from '@/components/SaguaroDatePicker';

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
const GREEN_SOFT = 'rgba(69,179,125,0.15)';
const GREEN_BORDER = 'rgba(69,179,125,0.5)';
const NEST = 'rgba(20,20,22,0.55)';

/* ── Types (mirror the server layer; v2 fields optional — render only when present) */
interface RadioChannel {
  id: string;
  project_id: string | null;
  /** Project display name — rides the list GET when the server provides it. */
  project_name?: string | null;
  name: string;
  kind: 'project' | 'custom' | 'direct';
  allow_subs: boolean;
  members: number;
  monitoring: boolean;
  /** v2: members seen on this channel in the last few minutes (presence). */
  onChannel?: number;
  /** v2: traffic since the caller's last_read_at. */
  unread?: number;
  /** Tier-1: dispatcher-invite-only channel (invisible to non-members). */
  locked?: boolean;
  /** Tier-1: priority channel — interrupts scanning first. */
  priority?: boolean;
  lastMessage: { kind: string; body: string | null; sender: string | null; at: string; secs: number | null } | null;
}
interface RadioMessage {
  id: string;
  kind: 'voice' | 'text' | 'image' | 'alert' | 'panic' | 'tone';
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
  /** v2: breadcrumb positions appended while a panic is live. */
  location_trail?: { lat: number; lng: number; at?: string }[] | null;
  /** v2: set when a dispatcher stands the panic down. */
  panic_resolved_at?: string | null;
  /** v2: members who have seen this row (from read piggyback), when computed. */
  seen_count?: number | null;
  /** Tier-1: source channel id when this row was mirrored through a patch. */
  patched_from?: string | null;
  created_at: string;
}
/** Guest sharing link (staff rows from GET /api/radio/guest?channelId=). */
interface GuestLink {
  id: string;
  token: string;
  label: string | null;
  can_talk: boolean;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}
/** Assistance request (rows from GET /api/radio/assist). */
interface AssistRow {
  id: string;
  channel_id: string | null;
  project_id: string | null;
  requester_user_id: string | null;
  requester_name: string | null;
  note: string | null;
  location: { lat: number; lng: number } | null;
  status: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
}
/** Channel roster row (GET /api/radio/channels?roster=). */
interface RosterMember {
  /** radio_members row id — present once the server exposes it; remove needs it. */
  id?: string | null;
  user_id: string | null;
  portal_sub_id?: string | null;
  display_name: string | null;
  call_sign: string | null;
  presence_status: 'available' | 'busy' | 'on_route' | 'off' | null;
  role: string | null;
  last_seen_at: string | null;
}
/** Directory person (GET /api/radio/channels?directory=1 → {staff, subs}).
 * Field names tolerated in both camelCase and snake_case so the console
 * survives server drift; ids resolve through the helpers below. */
interface DirectoryPerson {
  userId?: string | null;
  user_id?: string | null;
  portalSubId?: string | null;
  portal_sub_id?: string | null;
  name?: string | null;
  display_name?: string | null;
  email?: string | null;
  role?: string | null;
  company?: string | null;
}
const personUserId = (p: DirectoryPerson) => p.userId || p.user_id || null;
const personSubId = (p: DirectoryPerson) => p.portalSubId || p.portal_sub_id || null;
const personKey = (p: DirectoryPerson) => {
  const u = personUserId(p), s = personSubId(p);
  return u ? `u:${u}` : s ? `s:${s}` : `x:${p.email || p.name || p.display_name || 'unknown'}`;
};
const personName = (p: DirectoryPerson) =>
  String(p.name || p.display_name || p.email || 'Team member').trim() || 'Team member';
/** Live channel patch (rides the channels GET as `patches`). */
interface ActivePatch {
  id: string;
  channel_a: string;
  channel_b: string;
  created_at?: string;
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
const sizeLabel = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/* Attachments — mirror /api/radio/media's accept list and 50MB cap so a bad
 * pick fails instantly in the tray instead of round-tripping to a 4xx. */
const MEDIA_OK = /\.(png|jpe?g|webp|heic|gif|pdf|mp4|mov|webm)$/i;
const MEDIA_MAX_BYTES = 50 * 1024 * 1024;
const MEDIA_ACCEPT =
  'image/png,image/jpeg,image/webp,image/heic,image/gif,.png,.jpg,.jpeg,.webp,.heic,.gif,' +
  'application/pdf,.pdf,video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm';
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

/* Heard voice clips (per-browser; capped so localStorage never balloons). */
const HEARD_KEY = 'sag_radio_heard';
function readHeard(): string[] {
  try {
    const a = JSON.parse(window.localStorage.getItem(HEARD_KEY) || '[]');
    return Array.isArray(a) ? a.filter((x) => typeof x === 'string') : [];
  } catch { return []; }
}

/* Deterministic pseudo-waveform heights (FNV-ish hash of the message id). */
function waveHeights(id: string, n: number): number[] {
  let h = 2166136261;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    h ^= id.charCodeAt(i % Math.max(1, id.length)) + i * 131;
    h = Math.imul(h, 16777619);
    out.push(0.2 + ((Math.abs(h) % 1000) / 1000) * 0.8);
  }
  return out;
}

/* RMS of an analyser's current time-domain frame, soft-kneed onto the S/RF
 * meter's 0..1 scale (speech RMS lives around 0.03-0.3; the curve keeps the
 * needle lively across normal voice levels). */
function levelFromAnalyser(an: AnalyserNode): number {
  const buf = new Uint8Array(an.fftSize);
  an.getByteTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = (buf[i] - 128) / 128;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / buf.length);
  return Math.min(1, Math.pow(rms * 3.5, 0.6));
}

/* Animated equalizer bars (gold, staggered) — the ON AIR heartbeat. */
function EqBars({ color = GOLD_HI, size = 14 }: { color?: string; size?: number }) {
  return (
    <span aria-hidden style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: size, flexShrink: 0 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          style={{
            width: 3, height: size, borderRadius: 2, background: color, transformOrigin: 'bottom',
            animation: `sagRadioEq ${0.7 + (i % 3) * 0.18}s ease-in-out ${i * 0.09}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

/* Vivid gold module chip — the platform icon standard: a saturated gold plate
 * (bright-to-deep gradient) with a ring + soft glow and a near-white glyph ON
 * the color. Never gold-on-gold. Radio stays in the gold family. */
function VividGoldChip({
  icon,
  size = 40,
  style,
}: { icon: React.ReactNode; size?: number; style?: React.CSSProperties }) {
  return (
    <span
      aria-hidden
      style={{
        flexShrink: 0, width: size, height: size, borderRadius: Math.round(size * 0.29),
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: `linear-gradient(145deg, ${GOLD_HI} 0%, ${GOLD} 52%, #B45309 100%)`,
        border: '1px solid rgba(253,230,138,0.55)',
        boxShadow: '0 0 0 3px rgba(245,158,11,0.16), 0 10px 26px -10px rgba(245,158,11,0.60), inset 0 1px 0 rgba(255,255,255,0.40)',
        color: '#F8FAFC',
        ...style,
      }}
    >
      {icon}
    </span>
  );
}

/* Decorative tuning-band strip for the standby radio face — pure SVG in the
 * S/RF meter's family look (dark face + hairline bezel, white ticks, a red
 * top-band segment, gold needle, glass highlight). The "frequency" is seeded
 * from the active channel id so every channel holds its own spot on the band.
 * Purely decorative — no real RF here. */
function FrequencyDial({ seed }: { seed: string }) {
  const uid = React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const frac = 0.06 + ((Math.abs(h) % 1000) / 1000) * 0.88;
  const W = 760, H = 92, L = 34, R = 726;
  const xAt = (f: number) => L + f * (R - L);
  const nx = xAt(frac);
  const ticks = Array.from({ length: 41 }, (_, i) => i / 40);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', height: 'auto' }} aria-hidden focusable="false">
      <defs>
        <linearGradient id={`sagDialFace-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#17171C" />
          <stop offset="1" stopColor="#0B0B0E" />
        </linearGradient>
        <linearGradient id={`sagDialGlass-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(255,255,255,0.09)" />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <linearGradient id={`sagDialNeedle-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={GOLD_HI} />
          <stop offset="1" stopColor={GOLD} />
        </linearGradient>
      </defs>
      {/* Bezel + face */}
      <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill="#18181E" stroke="rgba(255,255,255,0.13)" strokeWidth={1} />
      <rect x={6} y={6} width={W - 12} height={H - 12} rx={12} fill={`url(#sagDialFace-${uid})`} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
      {/* Band line — white span + red top segment (the S-meter split) */}
      <line x1={L} y1={22} x2={xAt(0.86)} y2={22} stroke="rgba(255,255,255,0.40)" strokeWidth={1.4} />
      <line x1={xAt(0.86)} y1={22} x2={R} y2={22} stroke={RED} strokeWidth={3} />
      {/* Ticks + MHz numerals */}
      {ticks.map((f, i) => (
        <line
          key={i}
          x1={xAt(f)} y1={24} x2={xAt(f)} y2={i % 5 === 0 ? 44 : 35}
          stroke={f >= 0.86 ? 'rgba(248,113,113,0.75)' : i % 5 === 0 ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.40)'}
          strokeWidth={i % 5 === 0 ? 1.6 : 1}
        />
      ))}
      {[0, 10, 20, 30, 40].map((i) => (
        <text key={i} x={xAt(i / 40)} y={58} textAnchor="middle" fontSize={11} fontWeight={700} fill={i === 40 ? '#F87171' : 'rgba(255,255,255,0.62)'}>
          {(26.9 + (i / 40) * 0.5).toFixed(1)}
        </text>
      ))}
      {/* Legend + standby lamp */}
      <text x={W / 2} y={78} textAnchor="middle" fontSize={9} fontWeight={800} letterSpacing="0.22em" fill="rgba(255,255,255,0.46)">
        FREQ — MHZ
      </text>
      <circle cx={30} cy={74} r={8.5} fill={GOLD_HI} opacity={0.16} />
      <circle cx={30} cy={74} r={4.2} fill={GOLD_HI} stroke="rgba(255,255,255,0.30)" strokeWidth={0.8} />
      <text x={40} y={77} fontSize={7.5} fontWeight={800} letterSpacing="0.08em" fill={GOLD_HI}>STBY</text>
      {/* Needle — seeded per channel */}
      <rect x={nx - 5} y={12} width={10} height={56} rx={4} fill={GOLD} opacity={0.14} />
      <line x1={nx} y1={12} x2={nx} y2={66} stroke={`url(#sagDialNeedle-${uid})`} strokeWidth={2.4} strokeLinecap="round" />
      <path d={`M ${nx - 4} 12 L ${nx + 4} 12 L ${nx} 19 Z`} fill={GOLD_HI} />
      {/* Glass highlight */}
      <path d={`M 6 6 H ${W - 6} V 34 Q ${W / 2} 52 6 34 Z`} fill={`url(#sagDialGlass-${uid})`} pointerEvents="none" />
    </svg>
  );
}

/* One-line preview of a channel's last transmission (standby panel). */
const trafficPreview = (lm: NonNullable<RadioChannel['lastMessage']>) =>
  lm.kind === 'voice' ? `PTT ${secsLabel(lm.secs)}`
    : lm.kind === 'panic' ? 'PANIC ALARM'
    : lm.kind === 'image' ? 'Photo'
    : lm.kind === 'tone' ? 'Tone'
    : (lm.body || '').slice(0, 80) || 'Traffic';
const whenLabel = (iso: string) =>
  isToday(iso) ? timeOf(iso) : new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });

const rowActionStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 8,
  background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`,
  color: MUTED, fontSize: 10.5, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
};

/* ── Machined toolbar kit — the ONE secondary-control geometry (32px). No
 * mismatched pills: buttons stand alone or fuse into segmented groups with
 * hairline dividers, tertiary actions live behind the overflow menu, and
 * primary actions keep the gold pmBtn tier. */
const TOOL_H = 32;
const toolBtnStyle = (on: boolean, enabled: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  height: TOOL_H, padding: '0 12px', borderRadius: 9, boxSizing: 'border-box',
  background: on ? 'linear-gradient(180deg, rgba(245,158,11,0.28), rgba(245,158,11,0.12))' : FIELD_BG,
  border: on ? `1px solid ${AMBER_BORDER}` : FIELD_BORDER,
  color: on ? GOLD_HI : MUTED, fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap',
  cursor: enabled ? 'pointer' : 'default', opacity: enabled ? 1 : 0.45,
});
const toolGroupStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'stretch', height: TOOL_H, borderRadius: 9,
  border: FIELD_BORDER, background: FIELD_BG, overflow: 'hidden',
};
const toolSegStyle = (on: boolean, enabled: boolean, divider: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  height: '100%', padding: '0 12px', border: 'none', borderRadius: 0,
  borderLeft: divider ? `1px solid ${BORDER}` : 'none',
  background: on ? 'linear-gradient(180deg, rgba(245,158,11,0.28), rgba(245,158,11,0.12))' : 'transparent',
  color: on ? GOLD_HI : MUTED, fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap',
  cursor: enabled ? 'pointer' : 'default', opacity: enabled ? 1 : 0.45,
});
/* Kit popover / menu / modal shells — one look everywhere. */
const popoverStyle = (width: number): React.CSSProperties => ({
  position: 'absolute', right: 0, top: 'calc(100% + 10px)', width, zIndex: 50,
  background: 'rgba(24,24,27,0.98)', border: `1px solid ${AMBER_BORDER}`,
  borderRadius: 14, boxShadow: '0 22px 48px rgba(12,12,16,0.65)',
  padding: 14, textAlign: 'left',
});
const menuItemStyle = (enabled: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 9, width: '100%', boxSizing: 'border-box',
  height: 34, padding: '0 10px', borderRadius: 9, background: 'transparent', border: 'none',
  color: enabled ? WHITE : FAINT, fontSize: 12.5, fontWeight: 700, textAlign: 'left',
  cursor: enabled ? 'pointer' : 'default', whiteSpace: 'nowrap',
});
const modalShellStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(12,12,16,0.72)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  padding: '8vh 16px 16px', overflowY: 'auto',
};
const modalCardStyle = (width: number): React.CSSProperties => ({
  width: `min(${width}px, 100%)`, borderRadius: 16, background: 'rgba(24,24,27,0.98)',
  border: `1px solid ${AMBER_BORDER}`, boxShadow: '0 22px 48px rgba(12,12,16,0.65)', padding: 16,
});
const fieldStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px',
  background: FIELD_BG, border: FIELD_BORDER, borderRadius: 10,
  color: WHITE, fontSize: 12.5, outline: 'none',
};
const eyebrowStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 900, letterSpacing: '0.12em', color: FAINT,
};

/* Tone signaling — labels, colors, and distinct WebAudio beep frequencies. */
const TONES: Record<string, { label: string; color: string; border: string; soft: string; freq: number; hold: number }> = {
  ack: { label: 'ACK', color: GREEN, border: GREEN_BORDER, soft: GREEN_SOFT, freq: 880, hold: 0.22 },
  negative: { label: 'NEGATIVE', color: RED, border: RED_BORDER, soft: RED_SOFT, freq: 294, hold: 0.3 },
  comein: { label: 'COME IN', color: GOLD_HI, border: AMBER_BORDER, soft: AMBER_SOFT, freq: 587, hold: 0.45 },
};

/* Presence status — roster dot colors + labels (server enum). */
const PRESENCE: Record<string, { label: string; color: string }> = {
  available: { label: 'Available', color: GREEN },
  busy: { label: 'Busy', color: RED },
  on_route: { label: 'On route', color: GOLD_HI },
  off: { label: 'Off', color: FAINT },
};

/* Age of an assistance request, live against a ticking now. */
const ageLabel = (iso: string, nowMs: number) => {
  const s = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};

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

  /* Who am I (for own-alert "Seen" + skipping own clips in catch-up). */
  const [myUserId, setMyUserId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await ensureBrowserSession();
        const s = await getSession();
        if (alive) setMyUserId(s?.user?.id ?? null);
      } catch { /* demo mode — no session */ }
    })();
    return () => { alive = false; };
  }, []);

  /* ── Channels rail ──────────────────────────────────────────────────── */
  const channelsKey = ready
    ? (projectId ? `/api/radio/channels?projectId=${encodeURIComponent(projectId)}` : '/api/radio/channels')
    : null;
  const { data: chData, error: chError, mutate: mutateChannels } = useSWR<{ channels: RadioChannel[]; patches?: ActivePatch[] }>(
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

  /* ── Create group — a real flow: modal w/ name + project + member picker.
   * Create POSTs first, then adds each picked member sequentially; every
   * failure surfaces by name in an honest toast. */
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAllowSubs, setNewAllowSubs] = useState(false);
  const [newProject, setNewProject] = useState('');
  const [newQuery, setNewQuery] = useState('');
  const [newSel, setNewSel] = useState<DirectoryPerson[]>([]);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    if (showNew) { setNewProject(projectId || ''); setNewQuery(''); setNewSel([]); }
  }, [showNew, projectId]);
  const toggleNewPerson = (p: DirectoryPerson) => {
    setNewSel((prev) => prev.some((x) => personKey(x) === personKey(p))
      ? prev.filter((x) => personKey(x) !== personKey(p))
      : [...prev, p]);
  };
  const createChannel = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const r = await fetch('/api/radio/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, projectId: newProject || undefined, allowSubs: newAllowSubs }),
      });
      const j = r.ok ? await r.json().catch(() => null) : null;
      const chId: string | null = j?.channel?.id ?? null;
      if (!r.ok || !chId) {
        pushToast(`Could not create "${name}" (${r.status})`, 'err');
      } else {
        /* Sequential member adds — each failure is reported by name. */
        let added = 0;
        const failed: string[] = [];
        for (const p of newSel) {
          const uid = personUserId(p), sid = personSubId(p);
          const payload = uid
            ? { channelId: chId, addUserId: uid }
            : sid ? { channelId: chId, addPortalSubId: sid, displayName: personName(p) } : null;
          if (!payload) { failed.push(personName(p)); continue; }
          try {
            const ar = await fetch('/api/radio/channels', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            if (ar.ok) added += 1; else failed.push(personName(p));
          } catch { failed.push(personName(p)); }
        }
        setNewName(''); setNewAllowSubs(false); setShowNew(false);
        pushToast(`"${name}" is on the air${added ? ` — ${added} member${added === 1 ? '' : 's'} added` : ''}`, 'ok');
        if (failed.length) pushToast(`Could not add ${failed.join(', ')} — retry from the roster`, 'err');
        await mutateChannels();
        setActiveId(chId);
      }
    } catch { pushToast('Could not create the channel — check your connection', 'err'); }
    setCreating(false);
  };

  /* ── Assistance queue (SWR 10s — badge always live, board collapsible) ─ */
  const assistKey = ready
    ? (projectId ? `/api/radio/assist?projectId=${encodeURIComponent(projectId)}` : '/api/radio/assist')
    : null;
  const { data: assistData, mutate: mutateAssist } = useSWR<{ queue: AssistRow[] }>(
    assistKey, fetcher,
    { refreshInterval: 10_000, revalidateOnFocus: true, keepPreviousData: true },
  );
  const assistQueue = assistData?.queue ?? [];
  const assistOpenCount = assistQueue.filter((a) => a.status === 'open').length;
  const [assistShown, setAssistShown] = useState(false);
  const [assistBusy, setAssistBusy] = useState<string | null>(null);
  const [assistNow, setAssistNow] = useState(() => Date.now());
  useEffect(() => {
    if (!assistShown) return;
    setAssistNow(Date.now());
    const iv = setInterval(() => setAssistNow(Date.now()), 10_000);
    return () => clearInterval(iv);
  }, [assistShown]);
  const triageAssist = async (id: string, action: 'ack' | 'resolve') => {
    if (assistBusy) return;
    setAssistBusy(id);
    try {
      const r = await fetch('/api/radio/assist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assistId: id, action }),
      });
      if (r.ok) await mutateAssist();
    } catch { /* row stays queued — dispatcher retries */ }
    setAssistBusy(null);
  };

  /* ── Patch board (POST {patch:{a,b}}; live list rides the channels GET) */
  const patches = chData?.patches ?? [];
  const [patchA, setPatchA] = useState('');
  const [patchB, setPatchB] = useState('');
  const [patchBusy, setPatchBusy] = useState(false);
  const channelName = useCallback(
    (id: string) => channels.find((c) => c.id === id)?.name || 'Channel',
    [channels],
  );
  const postPatch = async (a: string, b: string, release: boolean) => {
    if (!a || !b || a === b || patchBusy) return;
    setPatchBusy(true);
    try {
      const r = await fetch('/api/radio/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch: release ? { a, b, release: true } : { a, b } }),
      });
      if (r.ok) {
        if (!release) { setPatchA(''); setPatchB(''); }
        await mutateChannels();
      }
    } catch { /* board unchanged — dispatcher retries */ }
    setPatchBusy(false);
  };

  /* ── Priority channel (star toggle — interrupts scanning first) ─────── */
  const [prioBusy, setPrioBusy] = useState<string | null>(null);
  const togglePriority = async (c: RadioChannel) => {
    if (prioBusy) return;
    setPrioBusy(c.id);
    try {
      const r = await fetch('/api/radio/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priorityChannelId: c.id, priority: !c.priority }),
      });
      if (r.ok) await mutateChannels();
    } catch { /* star stays — dispatcher retries */ }
    setPrioBusy(null);
  };

  /* ── Roster (member panel: GET ?roster= + POST profile for own row) ─── */
  const [rosterOpen, setRosterOpen] = useState(false);
  const rosterRef = useRef<HTMLDivElement | null>(null);
  const rosterKey = rosterOpen && activeId ? `/api/radio/channels?roster=${encodeURIComponent(activeId)}` : null;
  const { data: rosterData, error: rosterError, mutate: mutateRoster } = useSWR<{ members: RosterMember[] }>(
    rosterKey, fetcher, { refreshInterval: 30_000, revalidateOnFocus: false },
  );
  const rosterMembers = rosterData?.members ?? [];
  const [editingProfile, setEditingProfile] = useState(false);
  const [callSignDraft, setCallSignDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState<'available' | 'busy' | 'on_route' | 'off'>('available');
  const [savingProfile, setSavingProfile] = useState(false);
  useEffect(() => { setRosterOpen(false); setEditingProfile(false); }, [activeId]);
  useEffect(() => {
    if (!rosterOpen) return;
    const onDown = (e: PointerEvent) => {
      if (rosterRef.current && !rosterRef.current.contains(e.target as Node)) setRosterOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [rosterOpen]);
  const startEditProfile = (me: RosterMember) => {
    setCallSignDraft(me.call_sign || '');
    setStatusDraft(me.presence_status && PRESENCE[me.presence_status] ? me.presence_status : 'available');
    setEditingProfile(true);
  };
  // "Handle" header chip: one click opens the roster ALREADY in self-edit —
  // the CB handle must never be buried two taps deep.
  const pendingSelfEditRef = useRef(false);
  const myRosterRow = rosterMembers.find((m) => !!myUserId && m.user_id === myUserId) || null;
  useEffect(() => {
    if (!rosterOpen || !pendingSelfEditRef.current || !myRosterRow) return;
    pendingSelfEditRef.current = false;
    startEditProfile(myRosterRow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosterOpen, myRosterRow]);
  const saveProfile = async () => {
    if (savingProfile) return;
    setSavingProfile(true);
    try {
      const r = await fetch('/api/radio/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: { callSign: callSignDraft.trim(), presenceStatus: statusDraft } }),
      });
      if (r.ok) { setEditingProfile(false); await mutateRoster(); }
    } catch { /* panel stays in edit — dispatcher retries */ }
    setSavingProfile(false);
  };

  /* ── Realtime (postgres_changes INSERT on the active channel) ───────── */
  /* radio_messages is in the supabase_realtime publication; the browser anon
   * client is hydrated from the server's httpOnly cookies so RLS sees the
   * caller. While the socket reports SUBSCRIBED, delivery is instant and the
   * poll relaxes to a 15s safety net; any other state keeps the proven 4s poll. */
  const [rtLive, setRtLive] = useState(false);
  const mutateChannelsRef = useRef(mutateChannels);
  mutateChannelsRef.current = mutateChannels;
  const rtBumpRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!activeId || !HAS_SUPABASE) { setRtLive(false); return; }
    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    (async () => {
      await ensureBrowserSession(); // best-effort auth so RLS lets rows through
      if (cancelled) return;
      const sb = getSupabaseBrowser();
      channel = sb
        .channel(`radio:feed:${activeId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'radio_messages', filter: `channel_id=eq.${activeId}` },
          () => {
            rtBumpRef.current();          // immediate feed revalidate
            void mutateChannelsRef.current(); // rail previews + unread stay fresh
          },
        )
        .subscribe((status) => { if (!cancelled) setRtLive(status === 'SUBSCRIBED'); });
    })();
    return () => {
      cancelled = true;
      setRtLive(false);
      if (channel) { try { getSupabaseBrowser().removeChannel(channel); } catch { /* socket already gone */ } }
    };
  }, [activeId]);

  /* ── Feed (realtime-first; poll is the safety net) ──────────────────── */
  const messagesKey = activeId ? `/api/radio/messages?channelId=${encodeURIComponent(activeId)}` : null;
  const { data: msgData, error: msgError, mutate: mutateMessages } = useSWR<{ messages: RadioMessage[] }>(
    messagesKey, fetcher,
    { refreshInterval: rtLive ? 15_000 : 4000, revalidateOnFocus: true, keepPreviousData: false, dedupingInterval: 1500 },
  );
  const messages = msgData?.messages ?? [];
  const messagesRef = useRef<RadioMessage[]>(messages);
  messagesRef.current = messages;
  const mutateMessagesRef = useRef(mutateMessages);
  mutateMessagesRef.current = mutateMessages;
  rtBumpRef.current = () => { void mutateMessagesRef.current(); };

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

  /* ── S/RF meter — Web Audio plumbing (feature-detected) ─────────────── */
  /* One page-lifetime AudioContext serves both meter taps: an AnalyserNode
   * on the PTT mic stream (TX) and one on the shared playback element (RX).
   * A MediaElementSource can be created only ONCE per element — after that
   * it owns the element's audio path for the element's lifetime — so the RX
   * tap, once wired, is kept until the console unmounts. */
  const [meterLevel, setMeterLevel] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const playSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const playAnalyserRef = useRef<AnalyserNode | null>(null);
  const elementTapRef = useRef<'untried' | 'active' | 'failed'>('untried');
  const tapPlayerRef = useRef<() => void>(() => {});
  const getAudioCtx = useCallback((): AudioContext | null => {
    if (audioCtxRef.current) return audioCtxRef.current;
    try {
      const AC = window.AudioContext
        || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      audioCtxRef.current = new AC();
    } catch { return null; }
    return audioCtxRef.current;
  }, []);

  /* ── Voice playback (shared player + catch-up queue) ────────────────── */
  const [heard, setHeard] = useState<Set<string>>(new Set());
  useEffect(() => { setHeard(new Set(readHeard())); }, []);
  const markHeard = useCallback((id: string) => {
    setHeard((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      try { window.localStorage.setItem(HEARD_KEY, JSON.stringify([...next].slice(-500))); } catch { /* best-effort */ }
      return next;
    });
  }, []);

  const playerRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<string[]>([]);
  const advanceRef = useRef<() => void>(() => {});
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playProg, setPlayProg] = useState(0);
  const [catchingUp, setCatchingUp] = useState(false);

  const ensurePlayer = useCallback(() => {
    if (!playerRef.current) {
      const a = new Audio();
      a.preload = 'none';
      /* CORS mode so the RX meter's AnalyserNode reads real samples (signed
       * Supabase storage URLs answer with ACAO:*). If the very first load
       * rejects CORS, onerror drops the attribute and retries the clip
       * un-tapped — playback always beats metering. */
      a.crossOrigin = 'anonymous';
      a.onended = () => advanceRef.current();
      a.onerror = () => {
        if (!playSourceRef.current && a.crossOrigin === 'anonymous') {
          elementTapRef.current = 'failed';
          a.crossOrigin = null;
          const src = a.src;
          if (src) {
            a.src = src;
            a.load();
            a.play().catch(() => advanceRef.current());
            return;
          }
        }
        advanceRef.current();
      };
      a.onplaying = () => tapPlayerRef.current();
      a.ontimeupdate = () => setPlayProg(a.duration > 0 ? a.currentTime / a.duration : 0);
      playerRef.current = a;
    }
    return playerRef.current;
  }, []);

  const stopPlayback = useCallback(() => {
    const a = playerRef.current;
    if (a) { a.pause(); a.removeAttribute('src'); }
    queueRef.current = [];
    setPlayingId(null);
    setPlayProg(0);
    setCatchingUp(false);
  }, []);

  const playById = useCallback((id: string) => {
    const m = messagesRef.current.find((x) => x.id === id);
    if (!m?.audio_url) { advanceRef.current(); return; }
    const a = ensurePlayer();
    a.src = m.audio_url;
    a.currentTime = 0;
    setPlayingId(id);
    setPlayProg(0);
    markHeard(id);
    a.play().catch(() => advanceRef.current());
  }, [ensurePlayer, markHeard]);

  advanceRef.current = () => {
    const next = queueRef.current.shift();
    if (next) { playById(next); return; }
    setPlayingId(null);
    setPlayProg(0);
    setCatchingUp(false);
  };

  const toggleClip = (m: RadioMessage) => {
    if (playingId === m.id) { stopPlayback(); return; }
    queueRef.current = [];
    setCatchingUp(false);
    playById(m.id);
  };

  const unheardVoice = useMemo(
    () => messages.filter((m) =>
      m.kind === 'voice' && m.audio_url && !heard.has(m.id) && (!myUserId || m.sender_user_id !== myUserId)),
    [messages, heard, myUserId],
  );
  const startCatchUp = () => {
    const q = unheardVoice.map((m) => m.id);
    if (!q.length) return;
    setCatchingUp(true);
    queueRef.current = q.slice(1);
    playById(q[0]);
  };

  /* Stop playback when the channel changes or the console unmounts. */
  useEffect(() => { stopPlayback(); }, [activeId, stopPlayback]);
  useEffect(() => () => {
    const a = playerRef.current;
    if (a) { a.pause(); a.removeAttribute('src'); }
  }, []);

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

  /* ── Tone signaling (ACK / NEGATIVE / COME IN — kind 'tone') ────────── */
  /* Short sine beep through the page's shared AudioContext; each tone has
   * its own frequency so dispatchers learn them by ear. Best-effort — the
   * labeled chip in the feed is the source of truth. */
  const playToneBeep = useCallback((tone: string) => {
    const meta = TONES[tone];
    if (!meta) return;
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      if (ctx.state !== 'running') void ctx.resume().catch(() => { /* beep skipped */ });
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = meta.freq;
      const t0 = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + meta.hold);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + meta.hold + 0.1);
    } catch { /* beep is best-effort — the chip still renders */ }
  }, [getAudioCtx]);

  const [toneSending, setToneSending] = useState<string | null>(null);
  const sendTone = async (tone: 'ack' | 'negative' | 'comein') => {
    if (!activeId || toneSending) return;
    setToneSending(tone);
    playToneBeep(tone); // local sidetone — the sender hears their own beep
    try {
      const r = await fetch('/api/radio/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: activeId, kind: 'tone', body: tone }),
      });
      if (r.ok) {
        const j = await r.json().catch(() => null);
        if (j?.message?.id) toneSeenRef.current.add(String(j.message.id)); // no double beep
        await mutateMessages();
      }
    } catch { /* chip absence tells the dispatcher to re-key */ }
    setToneSending(null);
  };

  /* Beep on arrival: any tone row this browser has not seen (and did not
   * send) beeps once while fresh — old rows seed the set silently. */
  const toneSeenRef = useRef<Set<string>>(new Set());
  const toneChannelRef = useRef<string | null>(null);
  useEffect(() => {
    const seen = toneSeenRef.current;
    if (toneChannelRef.current !== activeId) {
      toneChannelRef.current = activeId;
      seen.clear();
    }
    for (const m of messages) {
      if (m.kind !== 'tone' || seen.has(m.id)) continue;
      seen.add(m.id);
      const fresh = Date.now() - new Date(m.created_at).getTime() < 30_000;
      if (fresh && (!myUserId || m.sender_user_id !== myUserId)) playToneBeep(m.body || '');
    }
  }, [messages, activeId, myUserId, playToneBeep]);

  /* ── Recording console (channel log: date range + search + print) ───── */
  const [logOpen, setLogOpen] = useState(false);
  const [logFrom, setLogFrom] = useState('');
  const [logTo, setLogTo] = useState('');
  const [logSearch, setLogSearch] = useState('');
  useEffect(() => { setLogOpen(false); setLogSearch(''); }, [activeId]);
  const logRangeParams = useMemo(() => {
    /* SaguaroDatePicker hands back local calendar dates; the range is the
     * whole local day on each end, sent as ISO instants (&from=&to=). */
    const parse = (iso: string, end: boolean) => {
      const [y, mo, d] = iso.split('-').map(Number);
      if (!y || !mo || !d) return null;
      const dt = end ? new Date(y, mo - 1, d, 23, 59, 59, 999) : new Date(y, mo - 1, d);
      return isNaN(dt.getTime()) ? null : dt.toISOString();
    };
    const from = logFrom ? parse(logFrom, false) : null;
    const to = logTo ? parse(logTo, true) : null;
    return `${from ? `&from=${encodeURIComponent(from)}` : ''}${to ? `&to=${encodeURIComponent(to)}` : ''}`;
  }, [logFrom, logTo]);
  const logKey = logOpen && activeId
    ? `/api/radio/messages?channelId=${encodeURIComponent(activeId)}${logRangeParams}`
    : null;
  const { data: logData, error: logError } = useSWR<{ messages: RadioMessage[] }>(
    logKey, fetcher, { revalidateOnFocus: false, keepPreviousData: true },
  );
  const logText = useCallback((m: RadioMessage) => {
    if (m.kind === 'voice') return m.transcript || `[voice clip${m.audio_duration_secs ? ` ${secsLabel(m.audio_duration_secs)}` : ''} — no transcript]`;
    if (m.kind === 'tone') return `[tone — ${TONES[m.body || '']?.label || (m.body || '').toUpperCase()}]`;
    if (m.kind === 'image') return m.body ? `[photo] ${m.body}` : '[photo]';
    return m.body || '';
  }, []);
  const logRows = useMemo(() => {
    const all = logData?.messages ?? [];
    const q = logSearch.trim().toLowerCase();
    if (!q) return all;
    return all.filter((m) =>
      logText(m).toLowerCase().includes(q) ||
      (m.sender_name || '').toLowerCase().includes(q) ||
      m.kind.toLowerCase().includes(q));
  }, [logData, logSearch, logText]);

  /* ── Attach (photos / PDFs / video → /api/radio/media) ──────────────── */
  /* Paperclip in the composer or drag-drop onto the feed; either way the
   * file lands in a pending tray with an inline caption prompt first. */
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [mediaCaption, setMediaCaption] = useState('');
  const [attachError, setAttachError] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const dragDepthRef = useRef(0);

  const takeFile = useCallback((f: File | null | undefined) => {
    if (!f) return;
    if (!MEDIA_OK.test(f.name || '')) {
      setPendingFile(null);
      setAttachError('Unsupported type — the channel takes photos, PDFs, and video (mp4 / mov / webm).');
      return;
    }
    if (f.size > MEDIA_MAX_BYTES) {
      setPendingFile(null);
      setAttachError(`Too large (${sizeLabel(f.size)}) — the channel takes files up to 50 MB.`);
      return;
    }
    setAttachError(null);
    setMediaCaption('');
    setPendingFile(f);
  }, []);

  const clearAttach = () => {
    setPendingFile(null);
    setMediaCaption('');
    setAttachError(null);
  };

  /* Dropping the attachment when the dispatcher switches channels. */
  useEffect(() => { setPendingFile(null); setMediaCaption(''); setAttachError(null); }, [activeId]);

  const sendMedia = async () => {
    if (!pendingFile || !activeId || uploadingMedia) return;
    setUploadingMedia(true);
    try {
      const fd = new FormData();
      fd.append('channelId', activeId);
      const cap = mediaCaption.trim();
      if (cap) fd.append('caption', cap);
      fd.append('file', pendingFile);
      const r = await fetch('/api/radio/media', { method: 'POST', body: fd });
      if (r.ok) {
        clearAttach();
        await mutateMessages();
        void mutateChannels(); // rail preview shows the share
      } else {
        const j = await r.json().catch(() => null);
        setAttachError((j && typeof j.error === 'string' && j.error) || `Upload failed (${r.status})`);
      }
    } catch { setAttachError('Upload failed — check your connection and try again.'); }
    setUploadingMedia(false);
  };

  /* Drag-drop onto the feed — same intake as the paperclip. */
  const hasFiles = (e: React.DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
  const onFeedDragEnter = (e: React.DragEvent) => {
    if (!hasFiles(e) || !activeId) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setDragOver(true);
  };
  const onFeedDragOver = (e: React.DragEvent) => {
    if (!hasFiles(e) || !activeId) return;
    e.preventDefault();
  };
  const onFeedDragLeave = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragOver(false);
  };
  const onFeedDrop = (e: React.DragEvent) => {
    if (!hasFiles(e) || !activeId) return;
    e.preventDefault();
    dragDepthRef.current = 0;
    setDragOver(false);
    takeFile(e.dataTransfer.files?.[0]);
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
    stopPlayback(); // never transmit over receive
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
        /* Release the meter's mic tap with the stream. */
        try { micSourceRef.current?.disconnect(); } catch { /* graph already gone */ }
        micSourceRef.current = null;
        micAnalyserRef.current = null;
        const durationSecs = (Date.now() - recStartRef.current) / 1000;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        chunksRef.current = [];
        if (durationSecs < 0.5 || blob.size === 0 || !activeId) return;
        const mt = rec.mimeType || '';
        const ext = mt.includes('mp4') ? 'mp4' : mt.includes('ogg') ? 'ogg' : mt.includes('wav') ? 'wav' : 'webm';
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
      /* Tap the live mic stream for the S/RF meter (feature-detected; the
       * meter falls back to a synthesized envelope without Web Audio). */
      try {
        const ctx = getAudioCtx();
        if (ctx) {
          if (ctx.state !== 'running') void ctx.resume().catch(() => { /* meter falls back */ });
          const src = ctx.createMediaStreamSource(stream);
          const an = ctx.createAnalyser();
          an.fftSize = 512;
          src.connect(an); // analysis only — never wired to destination (no sidetone)
          micSourceRef.current = src;
          micAnalyserRef.current = an;
        }
      } catch { /* meter falls back to the synthesized envelope */ }
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

  /* ── Hold-SPACEBAR PTT (dispatcher muscle memory) ───────────────────── */
  /* Keydown keys up, keyup transmits. Ignored while typing in any field. */
  const [spaceKeyed, setSpaceKeyed] = useState(false);
  const spaceDownRef = useRef(false);
  const pttStartRef = useRef<() => void>(() => {});
  const pttStopRef = useRef<() => void>(() => {});
  pttStartRef.current = () => { void pttStart(); };
  pttStopRef.current = pttStop;
  useEffect(() => {
    const isTyping = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      if (!el || !el.tagName) return false;
      const tag = el.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || spaceDownRef.current || isTyping(e.target)) return;
      e.preventDefault();
      spaceDownRef.current = true;
      setSpaceKeyed(true);
      pttStartRef.current();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || !spaceDownRef.current) return;
      e.preventDefault();
      spaceDownRef.current = false;
      setSpaceKeyed(false);
      pttStopRef.current();
    };
    const cancel = () => {
      if (!spaceDownRef.current) return;
      spaceDownRef.current = false;
      setSpaceKeyed(false);
      pttStopRef.current();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', cancel);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', cancel);
    };
  }, []);

  /* ── S/RF meter drive (tx while keyed, rx while playing, idle otherwise) */
  /* RX tap: created on the first successful CORS 'playing' event, then kept
   * for the element's lifetime (a MediaElementSource cannot be detached from
   * its element). The tap re-routes the element's audio through the graph,
   * so the analyser is wired on to destination to keep clips audible. */
  const tapPlayer = () => {
    const a = playerRef.current;
    if (!a || playSourceRef.current || elementTapRef.current === 'failed') return;
    if (a.crossOrigin !== 'anonymous') { elementTapRef.current = 'failed'; return; }
    const ctx = getAudioCtx();
    if (!ctx) { elementTapRef.current = 'failed'; return; }
    if (ctx.state !== 'running') {
      /* Autoplay policy: tapping a suspended context would mute the clip.
       * Nudge it awake and try again on the next 'playing' event. */
      void ctx.resume().catch(() => { /* stays untried */ });
      return;
    }
    try {
      const src = ctx.createMediaElementSource(a);
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      an.connect(ctx.destination); // keep playback audible through the tap
      playSourceRef.current = src;
      playAnalyserRef.current = an;
      elementTapRef.current = 'active';
    } catch { elementTapRef.current = 'failed'; }
  };
  tapPlayerRef.current = tapPlayer;

  const meterMode: 'idle' | 'rx' | 'tx' = recording ? 'tx' : playingId ? 'rx' : 'idle';
  const playingIdRef = useRef<string | null>(null);
  playingIdRef.current = playingId;
  useEffect(() => {
    if (meterMode === 'idle') { setMeterLevel(0); return; }
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 90) return; // ~11 Hz — the meter's own spring interpolates between samples
      last = now;
      const ctx = audioCtxRef.current;
      const live = !!ctx && ctx.state === 'running';
      let target = 0;
      if (meterMode === 'tx') {
        if (live && micAnalyserRef.current) {
          target = levelFromAnalyser(micAnalyserRef.current); // real mic level
        } else {
          /* Honest fallback: no Web Audio tap available, so this is a
           * synthesized modulation-style envelope — a plausible voice
           * cadence, NOT the real microphone level. */
          const t = now / 1000;
          target = 0.44 + 0.26 * Math.sin(t * 6.7) * Math.sin(t * 1.9) + 0.12 * Math.sin(t * 13.1);
        }
      } else {
        const a = playerRef.current;
        if (live && playAnalyserRef.current) {
          target = levelFromAnalyser(playAnalyserRef.current); // real playback level
        } else if (a && a.duration > 0) {
          /* Fallback: sample the same seeded pseudo-waveform the feed row
           * renders, synced to currentTime — deterministic per clip, NOT
           * real audio analysis. */
          const id = playingIdRef.current;
          if (id) {
            const m = messagesRef.current.find((x) => x.id === id);
            const n = Math.max(18, Math.min(42, Math.round((m?.audio_duration_secs || a.duration || 8) * 2)));
            const hs = waveHeights(id, n);
            const i = Math.min(n - 1, Math.max(0, Math.floor((a.currentTime / a.duration) * n)));
            target = 0.12 + hs[i] * 0.7;
          }
        }
      }
      target = Math.min(0.98, Math.max(0.04, target));
      setMeterLevel((prev) => (Math.abs(prev - target) < 0.015 ? prev : target));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [meterMode]);

  /* Tear the whole audio graph down with the console. */
  useEffect(() => () => {
    try { micSourceRef.current?.disconnect(); } catch { /* graph already gone */ }
    micSourceRef.current = null;
    micAnalyserRef.current = null;
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    if (ctx) void ctx.close().catch(() => { /* already closed */ });
  }, []);

  /* ── File to log (row hover action) ─────────────────────────────────── */
  const [filedIds, setFiledIds] = useState<Set<string>>(new Set());
  const [filingId, setFilingId] = useState<string | null>(null);
  const fileToLog = async (m: RadioMessage) => {
    if (filingId || filedIds.has(m.id) || !activeId) return;
    setFilingId(m.id);
    try {
      const r = await fetch('/api/radio/file-to-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: m.id, channelId: activeId }),
      });
      if (r.ok) setFiledIds((prev) => new Set(prev).add(m.id));
    } catch { /* row simply stays unfiled — dispatcher retries */ }
    setFilingId(null);
  };

  /* ── Share channel (guest links via /api/radio/guest) ───────────────── */
  /* Header popover: list + revoke the channel's live links, mint new ones
   * (label, talk toggle, expiry), copy the absolute guest URL one-click. */
  const [shareOpen, setShareOpen] = useState(false);
  const shareRef = useRef<HTMLDivElement | null>(null);
  const [shareLabel, setShareLabel] = useState('');
  const [shareTalk, setShareTalk] = useState(true);
  const [shareDays, setShareDays] = useState<'7' | '30' | '90' | 'never'>('30');
  const [creatingLink, setCreatingLink] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const linksKey = shareOpen && activeId ? `/api/radio/guest?channelId=${encodeURIComponent(activeId)}` : null;
  const { data: linkData, error: linkError, mutate: mutateLinks } = useSWR<{ links: GuestLink[] }>(
    linksKey, fetcher, { revalidateOnFocus: false },
  );
  const guestLinks = (linkData?.links ?? []).filter((l) => !l.revoked_at);

  const closeShare = useCallback(() => {
    setShareOpen(false);
    setCreatedUrl(null);
    setShareError(null);
  }, []);
  useEffect(() => { closeShare(); setShareLabel(''); }, [activeId, closeShare]);
  useEffect(() => {
    if (!shareOpen) return;
    const onDown = (e: PointerEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) closeShare();
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [shareOpen, closeShare]);

  const guestAbsUrl = (token: string) => `${window.location.origin}/portals/radio/${token}`;
  const copyShare = async (key: string, text: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedKey(key);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedKey(null), 1800);
    } catch { /* clipboard blocked — the URL stays visible to select by hand */ }
  };
  useEffect(() => () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); }, []);

  const createGuestLink = async () => {
    if (!activeId || creatingLink) return;
    setCreatingLink(true);
    setShareError(null);
    try {
      const payload: Record<string, unknown> = { channelId: activeId, canTalk: shareTalk };
      const label = shareLabel.trim();
      if (label) payload.label = label;
      if (shareDays !== 'never') payload.expiresDays = Number(shareDays);
      const r = await fetch('/api/radio/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.url) {
        setCreatedUrl(`${window.location.origin}${j.url}`);
        setShareLabel('');
        await mutateLinks();
      } else {
        setShareError((j && typeof j.error === 'string' && j.error) || `Could not create the link (${r.status})`);
      }
    } catch { setShareError('Could not create the link — check your connection and try again.'); }
    setCreatingLink(false);
  };

  const revokeGuestLink = async (linkId: string) => {
    if (revokingId) return;
    setRevokingId(linkId);
    try {
      const r = await fetch('/api/radio/guest', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkId }),
      });
      if (r.ok) await mutateLinks();
    } catch { /* link stays listed — staff retries */ }
    setRevokingId(null);
  };

  /* ── Toasts — honest, transient result reporting (kit-styled, no library) */
  const [toasts, setToasts] = useState<{ id: number; text: string; tone: 'ok' | 'err' }[]>([]);
  const toastSeqRef = useRef(1);
  const pushToast = useCallback((text: string, tone: 'ok' | 'err') => {
    const id = toastSeqRef.current++;
    setToasts((prev) => [...prev.slice(-3), { id, text, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 5200);
  }, []);

  /* ── Toolbar panels — one open at a time so the header reads as one kit ─ */
  const [patchOpen, setPatchOpen] = useState(false);
  const [bcOpen, setBcOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const patchBcRef = useRef<HTMLDivElement | null>(null);
  const openPanel = useCallback((which: 'share' | 'roster' | 'patch' | 'broadcast' | 'menu' | null) => {
    setShareOpen(which === 'share');
    if (which !== 'share') { setCreatedUrl(null); setShareError(null); }
    setRosterOpen(which === 'roster');
    setPatchOpen(which === 'patch');
    setBcOpen(which === 'broadcast');
    setMenuOpen(which === 'menu');
  }, []);
  useEffect(() => {
    if (!patchOpen && !bcOpen && !menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (patchBcRef.current?.contains(e.target as Node)) return;
      if (shareRef.current?.contains(e.target as Node)) return; // overflow menu shares this wrapper
      setPatchOpen(false); setBcOpen(false); setMenuOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [patchOpen, bcOpen, menuOpen]);

  /* ── Broadcast — one message onto up to 8 channels at once ───────────── */
  const [bcSel, setBcSel] = useState<Set<string>>(new Set());
  const [bcText, setBcText] = useState('');
  const [bcAlert, setBcAlert] = useState(false);
  const [bcBusy, setBcBusy] = useState(false);
  const [bcSent, setBcSent] = useState<string[] | null>(null);
  const toggleBcChannel = (id: string) => {
    setBcSent(null);
    setBcSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 8) next.add(id);
      return next;
    });
  };
  const sendBroadcast = async () => {
    const ids = [...bcSel];
    const text = bcText.trim();
    if (ids.length < 2 || !text || bcBusy) return;
    setBcBusy(true);
    setBcSent(null);
    try {
      const r = await fetch('/api/radio/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelIds: ids, kind: bcAlert ? 'alert' : 'text', body: text }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok) {
        const sentIds: string[] = Array.isArray(j?.messages)
          ? j.messages.map((m: { channel_id?: string }) => String(m?.channel_id || '')).filter(Boolean)
          : [];
        const landed = sentIds.length ? sentIds : ids;
        setBcSent(landed.map((id) => channelName(id)));
        setBcText(''); setBcSel(new Set());
        const skipped = ids.filter((id) => sentIds.length && !sentIds.includes(id));
        if (skipped.length) pushToast(`Skipped ${skipped.map((id) => channelName(id)).join(', ')} — you are not a member`, 'err');
        await mutateMessages();
        void mutateChannels();
      } else {
        pushToast(`Broadcast failed (${r.status})`, 'err');
      }
    } catch { pushToast('Broadcast failed — check your connection', 'err'); }
    setBcBusy(false);
  };

  /* ── Directory (GET ?directory=1 → {staff, subs}) — fetched only while a
   * picker is on screen; tolerates a server without the branch. ─────────── */
  const [directOpen, setDirectOpen] = useState(false);
  const [directQuery, setDirectQuery] = useState('');
  const [directBusy, setDirectBusy] = useState<string | null>(null);
  const [rosterAddOpen, setRosterAddOpen] = useState(false);
  const [rosterAddQuery, setRosterAddQuery] = useState('');
  const [removeArm, setRemoveArm] = useState<string | null>(null);
  const [memberBusy, setMemberBusy] = useState<string | null>(null);
  const dirKey = showNew || directOpen || rosterAddOpen ? '/api/radio/channels?directory=1' : null;
  const { data: dirData, error: dirError } = useSWR<{ staff?: DirectoryPerson[]; subs?: DirectoryPerson[] }>(
    dirKey, fetcher, { revalidateOnFocus: false },
  );
  const dirReady = !!dirData && (Array.isArray(dirData.staff) || Array.isArray(dirData.subs));
  const dirStaff: DirectoryPerson[] = (dirReady && dirData?.staff) || [];
  const dirSubs: DirectoryPerson[] = (dirReady && dirData?.subs) || [];

  /* Panels tied to the active channel reset when the dispatcher retunes. */
  useEffect(() => {
    setPatchOpen(false); setBcOpen(false); setMenuOpen(false);
    setBcSent(null); setRosterAddOpen(false); setRosterAddQuery(''); setRemoveArm(null);
  }, [activeId]);

  /* ── Direct 1:1 — person picker → POST {directToUserId} → tune in ────── */
  const startDirect = async (p: DirectoryPerson) => {
    const uid = personUserId(p);
    if (!uid || directBusy) return;
    setDirectBusy(personKey(p));
    try {
      const r = await fetch('/api/radio/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directToUserId: uid, directToName: personName(p) }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.channel?.id) {
        setDirectOpen(false);
        await mutateChannels();
        setActiveId(String(j.channel.id));
        pushToast(`Direct channel with ${personName(p)} is open`, 'ok');
      } else {
        pushToast(`Could not open a direct channel (${r.status})`, 'err');
      }
    } catch { pushToast('Could not open a direct channel — check your connection', 'err'); }
    setDirectBusy(null);
  };

  /* ── Roster member management (server add/remove branches) ───────────── */
  const rosterUserIds = useMemo(
    () => new Set(rosterMembers.map((m) => m.user_id).filter((x): x is string => !!x)),
    [rosterMembers],
  );
  const rosterSubIds = useMemo(
    () => new Set(rosterMembers.map((m) => m.portal_sub_id).filter((x): x is string => !!x)),
    [rosterMembers],
  );
  const addMember = async (p: DirectoryPerson) => {
    if (!activeId || memberBusy) return;
    const uid = personUserId(p), sid = personSubId(p);
    const payload = uid
      ? { channelId: activeId, addUserId: uid }
      : sid ? { channelId: activeId, addPortalSubId: sid, displayName: personName(p) } : null;
    if (!payload) return;
    setMemberBusy(personKey(p));
    try {
      const r = await fetch('/api/radio/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        pushToast(`${personName(p)} added to ${active?.name || 'the channel'}`, 'ok');
        await mutateRoster();
        void mutateChannels();
      } else {
        pushToast(`Could not add ${personName(p)} (${r.status})`, 'err');
      }
    } catch { pushToast(`Could not add ${personName(p)} — check your connection`, 'err'); }
    setMemberBusy(null);
  };
  const removeMember = async (mem: RosterMember) => {
    if (!mem.id || memberBusy) return;
    setMemberBusy(String(mem.id));
    try {
      const r = await fetch('/api/radio/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeMemberId: mem.id }),
      });
      if (r.ok) {
        pushToast(`${senderShort(mem.display_name)} removed from ${active?.name || 'the channel'}`, 'ok');
        await mutateRoster();
        void mutateChannels();
      } else {
        const je = await r.json().catch(() => null);
        pushToast((je && typeof je.error === 'string' && je.error) || `Could not remove ${senderShort(mem.display_name)} (${r.status})`, 'err');
      }
    } catch { pushToast('Could not remove the member — check your connection', 'err'); }
    setMemberBusy(null);
    setRemoveArm(null);
  };

  /* ── Lock / unlock — dispatcher-invite-only groups (confirm-gated) ───── */
  const [lockConfirm, setLockConfirm] = useState<RadioChannel | null>(null);
  const [lockBusy, setLockBusy] = useState(false);
  const applyLock = async () => {
    const c = lockConfirm;
    if (!c || lockBusy) return;
    setLockBusy(true);
    try {
      const r = await fetch('/api/radio/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lockChannelId: c.id, locked: !c.locked }),
      });
      if (r.ok) {
        pushToast(!c.locked ? `${c.name} locked — dispatcher invite only` : `${c.name} unlocked — open to the team`, 'ok');
        await mutateChannels();
        setLockConfirm(null);
      } else {
        pushToast(`Could not ${c.locked ? 'unlock' : 'lock'} ${c.name} (${r.status})`, 'err');
      }
    } catch { pushToast('Lock change failed — check your connection', 'err'); }
    setLockBusy(false);
  };

  /* ── Rail grouping — projects first, then Organization, Direct last ──── */
  const railGroups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, { key: string; label: string; rows: RadioChannel[] }>();
    for (const c of channels) {
      const key = c.kind === 'direct' ? '~direct' : c.project_id ? `p:${c.project_id}` : '~org';
      const label = c.kind === 'direct' ? 'Direct' : c.project_id ? (c.project_name || 'Project') : 'Organization';
      if (!map.has(key)) { map.set(key, { key, label, rows: [] }); order.push(key); }
      map.get(key)!.rows.push(c);
    }
    const rank = (k: string) => (k === '~direct' ? 2 : k === '~org' ? 1 : 0);
    return order
      .map((k, i) => ({ k, i }))
      .sort((a, b) => rank(a.k) - rank(b.k) || a.i - b.i)
      .map(({ k }) => map.get(k)!);
  }, [channels]);
  const projectOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of channels) if (c.project_id && !seen.has(c.project_id)) seen.set(c.project_id, c.project_name || 'Project');
    if (projectId && !seen.has(projectId)) seen.set(projectId, 'This project');
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [channels, projectId]);

  /* ── Directory list — the one member-picker renderer (check or pick) ─── */
  const renderDirectory = (opts: {
    query: string;
    mode: 'check' | 'pick';
    staffOnly?: boolean;
    excludeUsers?: Set<string>;
    excludeSubs?: Set<string>;
    selectedKeys?: Set<string>;
    busyKey?: string | null;
    pickIcon?: React.ReactNode;
    onRow: (p: DirectoryPerson) => void;
  }) => {
    if (dirKey && !dirData && !dirError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={34} borderRadius={9} />)}
        </div>
      );
    }
    if (dirError) return <div style={{ fontSize: 11.5, color: RED }}>Could not load the directory — close and reopen to retry.</div>;
    if (dirData && !dirReady) return <div style={{ fontSize: 11.5, color: FAINT }}>Directory unavailable — this server does not expose it yet.</div>;
    const q = opts.query.trim().toLowerCase();
    const hit = (p: DirectoryPerson) =>
      !q || personName(p).toLowerCase().includes(q) || String(p.role || '').toLowerCase().includes(q) || String(p.company || '').toLowerCase().includes(q);
    const staff = dirStaff.filter((p) => { const u = personUserId(p); return u && !opts.excludeUsers?.has(u) && hit(p); });
    const subs = opts.staffOnly ? [] : dirSubs.filter((p) => { const s = personSubId(p); return s && !opts.excludeSubs?.has(s) && hit(p); });
    if (!staff.length && !subs.length) {
      return <div style={{ fontSize: 11.5, color: FAINT }}>{q ? 'No one matches that search.' : 'Nobody available to add.'}</div>;
    }
    const row = (p: DirectoryPerson, sub: boolean) => {
      const key = personKey(p);
      const on = !!opts.selectedKeys?.has(key);
      const busy = opts.busyKey === key;
      return (
        <button
          key={key}
          onClick={() => opts.onRow(p)}
          disabled={busy}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%', boxSizing: 'border-box',
            padding: '6px 8px', borderRadius: 9, marginBottom: 2, textAlign: 'left', cursor: 'pointer',
            background: on ? AMBER_SOFT : 'transparent',
            border: on ? `1px solid ${AMBER_BORDER}` : '1px solid transparent',
            color: WHITE, opacity: busy ? 0.55 : 1,
          }}
        >
          {opts.mode === 'check' ? (
            <span
              aria-hidden
              style={{
                flexShrink: 0, width: 15, height: 15, borderRadius: 5,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: on ? `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})` : FIELD_BG,
                border: on ? 'none' : FIELD_BORDER, color: '#241500',
              }}
            >
              {on && <Check size={10} weight="bold" />}
            </span>
          ) : (
            <span aria-hidden style={{ flexShrink: 0, display: 'inline-flex', color: GOLD_HI }}>
              {opts.pickIcon || <UserPlus size={13} weight="bold" />}
            </span>
          )}
          <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {busy ? 'Working…' : personName(p)}
          </span>
          <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', color: FAINT, whiteSpace: 'nowrap' }}>
            {sub ? 'SUB' : String(p.role || 'STAFF').toUpperCase().slice(0, 14)}
          </span>
        </button>
      );
    };
    return (
      <>
        {staff.length > 0 && <div style={{ ...eyebrowStyle, margin: '2px 0 4px' }}>STAFF</div>}
        {staff.map((p) => row(p, false))}
        {subs.length > 0 && <div style={{ ...eyebrowStyle, margin: '6px 0 4px' }}>SUBCONTRACTORS</div>}
        {subs.map((p) => row(p, true))}
      </>
    );
  };

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

  /* ── Site Map (dispatch map + human heatmap) ────────────────────── */
  /* Collapsible panel over /api/radio/location: live pins poll at 15s while
   * the panel is open, heat bins at 60s. Keys are null while collapsed (or
   * without a projectId) so the closed panel costs zero requests. */
  const [mapOpen, setMapOpen] = useState(false);
  const [mapHours, setMapHours] = useState(10);
  const crewKey = mapOpen && projectId
    ? `/api/radio/location?projectId=${encodeURIComponent(projectId)}`
    : null;
  const { data: crewData, error: crewErr } = useSWR<{ crew: CrewPin[] }>(
    crewKey, fetcher,
    { refreshInterval: 15_000, revalidateOnFocus: true, keepPreviousData: true },
  );
  const heatKey = mapOpen && projectId
    ? `/api/radio/location?projectId=${encodeURIComponent(projectId)}&heatmap=1&hours=${mapHours}`
    : null;
  const { data: heatData, error: heatErr } = useSWR<{ bins: HeatBin[]; samples: number }>(
    heatKey, fetcher,
    { refreshInterval: 60_000, revalidateOnFocus: true, keepPreviousData: true },
  );
  /* Live unresolved panic positions from the active feed — pulsing red pins. */
  const panicPins = useMemo(
    () => messages
      .filter((m) => m.kind === 'panic' && !m.panic_resolved_at)
      .map((m) => {
        const trail = Array.isArray(m.location_trail)
          ? m.location_trail.filter((p) => p && typeof p.lat === 'number' && typeof p.lng === 'number')
          : [];
        const pos = trail.length ? trail[trail.length - 1] : m.location;
        return pos && typeof pos.lat === 'number' && typeof pos.lng === 'number'
          ? { lat: pos.lat, lng: pos.lng, name: senderShort(m.sender_name) }
          : null;
      })
      .filter((p): p is { lat: number; lng: number; name: string } => !!p),
    [messages],
  );
  const mapLoading = !!crewKey && ((!crewData && !crewErr) || (!heatData && !heatErr));

  /* ── Stats ──────────────────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const reachable = channels.reduce((max, c) => Math.max(max, Number(c.members) || 0), 0);
    const monitored = channels.filter((c) => isMonitored(c)).length;
    const trafficToday = messages.filter((m) => isToday(m.created_at)).length;
    return { channels: channels.length, reachable, monitored, trafficToday };
  }, [channels, messages, isMonitored]);

  const firstLoad = !chData && !chError;
  const playingMsg = playingId ? messages.find((m) => m.id === playingId) || null : null;
  const onAir = recording || !!playingId;

  /* ── Standby (radio-face panel when the feed is quiet) ──────────────── */
  /* Most recent traffic anywhere on the band — the rail data already has it. */
  const lastTraffic = useMemo(() => {
    let best: RadioChannel | null = null;
    for (const c of channels) {
      const at = c.lastMessage?.at;
      if (!at) continue;
      if (!best || new Date(at).getTime() > new Date(best.lastMessage!.at).getTime()) best = c;
    }
    return best;
  }, [channels]);
  /* The feed region never renders as a void: with no channel selected, or a
   * selected channel showing two or fewer rows, the standby panel fills it. */
  const standbyOn = !firstLoad && !msgError && (active ? !!msgData && messages.length <= 2 : !chError);

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

  const renderVoicePlayer = (m: RadioMessage) => {
    if (!m.audio_url) return null;
    const isPlaying = playingId === m.id;
    const n = Math.max(18, Math.min(42, Math.round((m.audio_duration_secs || 8) * 2)));
    const heights = waveHeights(m.id, n);
    const playedTo = isPlaying ? Math.floor(playProg * n) : 0;
    const unheardClip = !heard.has(m.id) && (!myUserId || m.sender_user_id !== myUserId);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, maxWidth: 420 }}>
        <button
          onClick={() => toggleClip(m)}
          aria-label={isPlaying ? 'Stop playback' : 'Play voice clip'}
          title={isPlaying ? 'Stop' : 'Play'}
          style={{
            flexShrink: 0, width: 32, height: 32, borderRadius: 10, padding: 0, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: isPlaying ? 'linear-gradient(180deg, rgba(245,158,11,0.35), rgba(245,158,11,0.16))' : 'rgba(245,158,11,0.12)',
            border: `1px solid ${AMBER_BORDER}`, color: GOLD_HI,
          }}
        >
          {isPlaying ? <Pause size={13} weight="fill" /> : <Play size={13} weight="fill" />}
        </button>
        <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', gap: 2, height: 28, flex: 1, minWidth: 0, overflow: 'hidden' }}>
          {heights.map((h, i) => (
            <span
              key={i}
              style={{
                width: 3, flexShrink: 0, borderRadius: 2,
                height: Math.round(5 + h * 22),
                background: isPlaying && i < playedTo
                  ? GOLD_HI
                  : unheardClip ? 'rgba(245,158,11,0.50)' : 'rgba(255,255,255,0.24)',
                transformOrigin: 'center',
                animation: isPlaying && i >= playedTo
                  ? `sagRadioEq ${0.8 + (i % 4) * 0.14}s ease-in-out ${(i % 5) * 0.07}s infinite`
                  : undefined,
              }}
            />
          ))}
        </span>
        {isPlaying && <EqBars size={12} />}
      </div>
    );
  };

  const renderRow = (m: RadioMessage) => {
    const panic = m.kind === 'panic';
    const alert = m.kind === 'alert';
    const tone = m.kind === 'tone' ? TONES[m.body || ''] : undefined;
    const resolved = panic && !!m.panic_resolved_at;
    const rowBg = panic ? (resolved ? 'rgba(239,68,68,0.05)' : RED_SOFT) : alert ? AMBER_SOFT : 'transparent';
    const rowBorder = panic
      ? `1px solid ${resolved ? 'rgba(239,68,68,0.20)' : RED_BORDER}`
      : alert ? `1px solid ${AMBER_BORDER}` : `1px solid ${BORDER}`;
    const translatedBody = m.translations?.[lang];
    const trail = panic && Array.isArray(m.location_trail)
      ? m.location_trail.filter((p) => p && typeof p.lat === 'number' && typeof p.lng === 'number')
      : [];
    const unheardClip = m.kind === 'voice' && !!m.audio_url && !heard.has(m.id) && (!myUserId || m.sender_user_id !== myUserId);
    const seenN = Number(m.seen_count ?? NaN);
    const showSeen = (alert || panic) && !!myUserId && m.sender_user_id === myUserId && Number.isFinite(seenN) && seenN > 0;
    return (
      <div
        key={m.id}
        className="sagRadioRow"
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
          {panic ? <Siren size={16} weight="fill" /> : alert ? <Warning size={16} weight="fill" /> : m.kind === 'voice' ? <SpeakerHigh size={15} weight="fill" /> : m.kind === 'tone' ? <BellRinging size={15} weight="fill" /> : initialsOf(m.sender_name)}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: panic ? RED : alert ? GOLD_HI : WHITE }}>
              {senderShort(m.sender_name)}
            </span>
            {m.patched_from && (
              <span
                title={`Mirrored from ${channelName(m.patched_from)} through an active patch`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9.5, fontWeight: 800, color: FAINT, border: `1px solid ${BORDER}`, borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap' }}
              >
                <PlugsConnected size={10} weight="bold" /> via {channelName(m.patched_from)}
              </span>
            )}
            {panic && (
              <span style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: '0.12em', color: RED, border: `1px solid ${RED_BORDER}`, borderRadius: 999, padding: '1px 7px' }}>
                PANIC
              </span>
            )}
            {resolved && (
              <span style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: '0.12em', color: GREEN, border: `1px solid ${GREEN_BORDER}`, borderRadius: 999, padding: '1px 7px' }}>
                RESOLVED {timeOf(m.panic_resolved_at as string)}
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
            {unheardClip && (
              <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.1em', color: GOLD_HI, background: AMBER_SOFT, border: `1px solid ${AMBER_BORDER}`, borderRadius: 999, padding: '1px 6px' }}>
                NEW
              </span>
            )}
            <span style={{ fontSize: 11, color: FAINT, marginLeft: 'auto', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
              {timeOf(m.created_at)}
            </span>
            {/* Hover actions — file this transmission to the project daily log */}
            <span className="sagRowActions" style={{ display: 'inline-flex', gap: 6, flexShrink: 0 }}>
              {filedIds.has(m.id) ? (
                <span style={{ ...rowActionStyle, cursor: 'default', color: GREEN, borderColor: GREEN_BORDER, background: GREEN_SOFT }}>
                  <Check size={11} weight="bold" /> Filed
                </span>
              ) : (
                <button
                  onClick={() => fileToLog(m)}
                  disabled={filingId === m.id}
                  title="File this transmission to the project daily log"
                  style={{ ...rowActionStyle, opacity: filingId === m.id ? 0.6 : 1 }}
                >
                  <ClipboardText size={11} weight="bold" /> {filingId === m.id ? 'Filing…' : 'File to log'}
                </button>
              )}
            </span>
          </div>

          {tone && (
            <div style={{ marginTop: 6 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, background: tone.soft, border: `1px solid ${tone.border}`, color: tone.color, fontSize: 11, fontWeight: 900, letterSpacing: '0.12em' }}>
                <BellRinging size={12} weight="fill" /> {tone.label}
                <span style={{ color: FAINT, fontWeight: 700, letterSpacing: 'normal' }}>beep</span>
              </span>
            </div>
          )}

          {m.kind === 'voice' && renderVoicePlayer(m)}
          {m.kind === 'voice' && renderTranscript(m)}

          {m.kind === 'image' && m.image_url && (
            <a href={m.image_url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 8 }}>
              <img src={m.image_url} alt="Radio photo" style={{ maxWidth: 260, maxHeight: 200, borderRadius: 10, border: `1px solid ${BORDER}`, display: 'block' }} />
            </a>
          )}

          {m.kind !== 'voice' && m.kind !== 'tone' && m.body && (
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

          {/* Location trail (v2) — numbered breadcrumbs, newest last */}
          {trail.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              <span style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: '0.12em', color: '#FCA5A5' }}>TRAIL</span>
              {trail.map((p, i) => (
                <a
                  key={i}
                  href={`https://maps.google.com/?q=${p.lat},${p.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  title={`${i === trail.length - 1 ? 'Latest position' : `Position ${i + 1}`}${p.at ? ` — ${timeOf(p.at)}` : ''}`}
                  style={{
                    width: 24, height: 24, borderRadius: 999, textDecoration: 'none',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10.5, fontWeight: 900, fontVariantNumeric: 'tabular-nums',
                    background: i === trail.length - 1 ? 'rgba(239,68,68,0.35)' : RED_SOFT,
                    border: `1px solid ${RED_BORDER}`, color: '#FCA5A5',
                  }}
                >
                  {i + 1}
                </a>
              ))}
            </div>
          )}

          {panic && trail.length === 0 && m.location && typeof m.location.lat === 'number' && (
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

          {showSeen && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: FAINT, marginTop: 5 }}>
              <Check size={11} weight="bold" /> Seen by {seenN}
            </div>
          )}
        </div>
      </div>
    );
  };

  const railRow = (c: RadioChannel) => {
    const isActive = c.id === activeId;
    const mon = isMonitored(c);
    const lm = c.lastMessage;
    const unread = typeof c.unread === 'number' && c.unread > 0 ? c.unread : 0;
    const onCh = typeof c.onChannel === 'number' && c.onChannel > 0 ? c.onChannel : 0;
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
          {c.kind === 'direct' ? <ChatCircleText size={14} weight="bold" /> : <Hash size={14} weight="bold" />}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: isActive ? GOLD_HI : WHITE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {c.name}
            </span>
            {c.locked && <Lock size={11} weight="fill" color={GOLD_HI} style={{ flexShrink: 0 }} />}
            {c.priority && <Star size={11} weight="fill" color={GOLD_HI} style={{ flexShrink: 0 }} />}
            {lm?.kind === 'panic' && <Siren size={12} weight="fill" color={RED} style={{ flexShrink: 0 }} />}
          </div>
          <div style={{ fontSize: 11, color: FAINT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
            <UsersThree size={11} weight="bold" style={{ verticalAlign: '-1px', marginRight: 4 }} />
            {c.members}
            {onCh > 0 && (
              <span style={{ color: GREEN, fontWeight: 800 }}>
                {' '}<span aria-hidden style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 999, background: GREEN, verticalAlign: '1px' }} /> {onCh} on
              </span>
            )}
            {' '}· {preview}
          </div>
        </div>
        {unread > 0 && !isActive && (
          <span
            title={`${unread} unread transmission${unread === 1 ? '' : 's'}`}
            style={{
              flexShrink: 0, minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`,
              color: '#241500', fontSize: 10.5, fontWeight: 900, fontVariantNumeric: 'tabular-nums',
            }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
        {c.kind !== 'direct' && (
          <button
            onClick={(e) => { e.stopPropagation(); setLockConfirm(c); }}
            title={c.locked ? 'Locked — dispatcher invite only. Click to unlock.' : 'Lock this channel — invite only, invisible to non-members'}
            aria-label={c.locked ? `Unlock ${c.name}` : `Lock ${c.name}`}
            style={{
              flexShrink: 0, width: 26, height: 26, borderRadius: 8, padding: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: c.locked ? 'rgba(245,158,11,0.14)' : 'transparent',
              border: c.locked ? '1px solid rgba(245,158,11,0.40)' : '1px solid transparent',
              color: c.locked ? GOLD_HI : FAINT, cursor: 'pointer',
            }}
          >
            {c.locked ? <Lock size={13} weight="fill" /> : <LockOpen size={13} weight="bold" />}
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); togglePriority(c); }}
          disabled={prioBusy === c.id}
          title={c.priority ? 'Priority channel — click to clear' : 'Make this a priority channel (interrupts scanning first)'}
          aria-label={c.priority ? `Clear priority on ${c.name}` : `Make ${c.name} a priority channel`}
          style={{
            flexShrink: 0, width: 26, height: 26, borderRadius: 8, padding: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: c.priority ? 'rgba(245,158,11,0.14)' : 'transparent',
            border: c.priority ? '1px solid rgba(245,158,11,0.40)' : '1px solid transparent',
            color: c.priority ? GOLD_HI : FAINT, cursor: 'pointer',
            opacity: prioBusy === c.id ? 0.5 : 1,
          }}
        >
          <Star size={13} weight={c.priority ? 'fill' : 'bold'} />
        </button>
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
  const activeOn = active && typeof active.onChannel === 'number' && active.onChannel > 0 ? active.onChannel : 0;
  return (
    <PremiumSurface maxWidth={1500}>
      <style>{`
        @keyframes sagRadioEq { 0%, 100% { transform: scaleY(0.35); } 50% { transform: scaleY(1); } }
        .sagRadioRow .sagRowActions { opacity: 0; pointer-events: none; transition: opacity .15s ease; }
        .sagRadioRow:hover .sagRowActions, .sagRadioRow:focus-within .sagRowActions { opacity: 1; pointer-events: auto; }
        @media print {
          body * { visibility: hidden; }
          #sagRadioLogPrint, #sagRadioLogPrint * {
            visibility: visible;
            color: #111111 !important;
            background: #FFFFFF !important;
            border-color: #BBBBBB !important;
            box-shadow: none !important;
          }
          #sagRadioLogPrint { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; }
          .sagRadioLogOverlay { position: static !important; overflow: visible !important; background: none !important; }
        }
      `}</style>
      <ModuleHero
        eyebrow="Dispatch Console"
        eyebrowIcon={<Broadcast size={13} weight="bold" />}
        title={
          <>
            <VividGoldChip
              icon={<Broadcast size={26} weight="fill" />}
              size={50}
              style={{ verticalAlign: 'middle', marginRight: 16, transform: 'translateY(-3px)' }}
            />
            Saguaro
          </>
        }
        accent="Radio"
        subtitle="Live talkgroups across the field — push-to-talk traffic, transcripts in English and Spanish, alerts, and a panic fan-out that reaches every member in seconds."
        actions={
          <>
            {/* Assistance queue toggle — badge counts the live queue */}
            <button
              onClick={() => setAssistShown((v) => !v)}
              title="Assistance queue — field requests waiting on dispatch"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '9px 14px', borderRadius: 12, cursor: 'pointer',
                background: assistShown ? 'linear-gradient(180deg, rgba(245,158,11,0.30), rgba(245,158,11,0.14))' : FIELD_BG,
                border: assistOpenCount > 0 ? `1px solid ${RED_BORDER}` : FIELD_BORDER,
                color: assistShown ? GOLD_HI : MUTED, fontWeight: 800, fontSize: 12.5,
              }}
            >
              <Lifebuoy size={15} weight="bold" /> Assist
              {assistQueue.length > 0 && (
                <span
                  style={{
                    minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: assistOpenCount > 0 ? RED : 'rgba(255,255,255,0.14)',
                    color: assistOpenCount > 0 ? WHITE : MUTED,
                    fontSize: 10, fontWeight: 900, fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {assistQueue.length}
                </span>
              )}
            </button>
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
                background: panicSent ? GREEN_SOFT : RED_SOFT,
                border: `1px solid ${panicSent ? GREEN_BORDER : RED_BORDER}`,
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

      {/* Site Map — live crew pins + human heatmap (collapsible) */}
      <SectionCard
        title="Site Map"
        subtitle={mapOpen ? 'Live crew positions and a human heatmap of where the work happened.' : undefined}
        icon={<MapTrifold size={16} weight="bold" color="#F8FAFC" />}
        action={
          <button
            onClick={() => setMapOpen((v) => !v)}
            aria-expanded={mapOpen}
            style={{ ...goldOutlineButtonStyle, padding: '6px 12px', fontSize: 12 }}
          >
            <CaretDown
              size={13}
              weight="bold"
              style={{ transform: mapOpen ? 'rotate(180deg)' : 'none', transition: 'transform .18s ease' }}
            />
            {mapOpen ? 'Hide map' : 'Show map'}
          </button>
        }
        style={{ marginBottom: 16 }}
        flush
      >
        {mapOpen ? (
          <CrewMap
            crew={crewData?.crew ?? []}
            bins={heatData?.bins ?? []}
            samples={heatData?.samples ?? 0}
            hours={mapHours}
            onHoursChange={setMapHours}
            panics={panicPins}
            hasProject={!!projectId}
            loading={mapLoading}
          />
        ) : (
          <div style={{ padding: '10px 20px 14px', fontSize: 12, color: FAINT }}>
            Live crew pins over a shift heatmap — positions appear when crews clock in with the Field app.
          </div>
        )}
      </SectionCard>

      {/* ── Assistance queue — collapsible dispatcher triage board ─────── */}
      {assistShown && (
        <div style={{ marginBottom: 20 }}>
          <SectionCard
            title="Assistance queue"
            subtitle={assistQueue.length ? `${assistOpenCount} waiting · ${assistQueue.length - assistOpenCount} acknowledged` : undefined}
            icon={<Lifebuoy size={16} weight="bold" color={assistOpenCount > 0 ? RED : '#F8FAFC'} />}
            action={
              <button
                onClick={() => setAssistShown(false)}
                aria-label="Collapse the assistance queue"
                style={{ background: 'none', border: 'none', color: FAINT, cursor: 'pointer', padding: 2, display: 'inline-flex' }}
              >
                <CaretUp size={14} weight="bold" />
              </button>
            }
          >
            {assistQueue.length === 0 ? (
              <div style={{ fontSize: 12.5, color: FAINT, padding: '2px 2px' }}>
                Queue is clear — no field requests waiting on dispatch.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {assistQueue.map((a) => {
                  const acked = a.status === 'acknowledged';
                  return (
                    <div
                      key={a.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                        padding: '10px 12px', borderRadius: 12,
                        background: acked ? NEST : AMBER_SOFT,
                        border: `1px solid ${acked ? BORDER : AMBER_BORDER}`,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 9.5, fontWeight: 900, letterSpacing: '0.12em', borderRadius: 999, padding: '2px 8px',
                          color: acked ? GREEN : RED,
                          border: `1px solid ${acked ? GREEN_BORDER : RED_BORDER}`,
                          background: acked ? GREEN_SOFT : RED_SOFT, whiteSpace: 'nowrap',
                        }}
                      >
                        {acked ? 'ACK' : 'OPEN'}
                      </span>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: WHITE }}>{senderShort(a.requester_name)}</span>
                        {a.note && <span style={{ fontSize: 12.5, color: MUTED }}> — {a.note}</span>}
                        {acked && a.acknowledged_by && (
                          <div style={{ fontSize: 10.5, color: FAINT, marginTop: 2 }}>
                            Acknowledged by {senderShort(a.acknowledged_by)}{a.acknowledged_at ? ` · ${timeOf(a.acknowledged_at)}` : ''}
                          </div>
                        )}
                      </div>
                      <span
                        title={new Date(a.created_at).toLocaleString()}
                        style={{ fontSize: 11, color: acked ? FAINT : GOLD_HI, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                      >
                        {ageLabel(a.created_at, assistNow)} ago
                      </span>
                      {a.location && typeof a.location.lat === 'number' && (
                        <a
                          href={`https://maps.google.com/?q=${a.location.lat},${a.location.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Open the requester's location in Google Maps"
                          style={{ ...rowActionStyle, textDecoration: 'none' }}
                        >
                          <MapPin size={11} weight="fill" /> Location
                        </a>
                      )}
                      {!acked && (
                        <button
                          onClick={() => triageAssist(a.id, 'ack')}
                          disabled={assistBusy === a.id}
                          title="Acknowledge — tells the requester dispatch is on it"
                          style={{ ...rowActionStyle, color: GOLD_HI, borderColor: AMBER_BORDER, background: 'rgba(245,158,11,0.14)', opacity: assistBusy === a.id ? 0.6 : 1 }}
                        >
                          <Check size={11} weight="bold" /> Ack
                        </button>
                      )}
                      <button
                        onClick={() => triageAssist(a.id, 'resolve')}
                        disabled={assistBusy === a.id}
                        title="Resolve — closes the request and notifies the requester"
                        style={{ ...rowActionStyle, color: GREEN, borderColor: GREEN_BORDER, background: GREEN_SOFT, opacity: assistBusy === a.id ? 0.6 : 1 }}
                      >
                        <Check size={11} weight="bold" /> Resolve
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* Rail + feed */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 300px) 1fr', gap: 16, alignItems: 'start' }}>
        {/* ── Channel rail + patch board ───────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <SectionCard
          title="Channels"
          icon={<Broadcast size={16} weight="bold" color="#F8FAFC" />}
          action={
            <div style={{ display: 'inline-flex', gap: 8 }}>
              <button
                onClick={() => setDirectOpen(true)}
                title="Message someone — a private 1:1 channel"
                style={toolBtnStyle(directOpen, true)}
              >
                <ChatCircleText size={13} weight="bold" /> Direct
              </button>
              <button
                onClick={() => setShowNew(true)}
                title="Create a talkgroup — name, project, and members"
                style={toolBtnStyle(showNew, true)}
              >
                <Plus size={13} weight="bold" /> New group
              </button>
            </div>
          }
          flush
        >
          <div style={{ padding: 10 }}>
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
            {railGroups.map((grp) => (
              <div key={grp.key} style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px 4px', minWidth: 0 }}>
                  <span style={{ ...eyebrowStyle, letterSpacing: '0.14em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                    {grp.label}
                  </span>
                  <span aria-hidden style={{ flex: 1, height: 1, background: BORDER }} />
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: FAINT, fontVariantNumeric: 'tabular-nums' }}>{grp.rows.length}</span>
                </div>
                <div style={{ paddingLeft: 6 }}>{grp.rows.map(railRow)}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        </div>

        {/* ── Feed ─────────────────────────────────────────────────────── */}
        <SectionCard
          title={active ? active.name : 'Channel'}
          subtitle={active ? `${active.project_name ? `${active.project_name} · ` : ''}${active.members} member${active.members === 1 ? '' : 's'}${activeOn ? ` · ${activeOn} on channel now` : ''}${active.locked ? ' · LOCKED' : ''}${active.priority ? ' · PRIORITY' : ''}${active.allow_subs ? ' · subs allowed' : ''}${active.kind === 'project' ? ' · project talkgroup' : active.kind === 'direct' ? ' · direct channel' : ''}` : undefined}
          icon={<Hash size={16} weight="bold" color="#F8FAFC" />}
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {rtLive && (
                <span
                  title="Live — transmissions arrive instantly over the realtime socket"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 900, letterSpacing: '0.1em', color: GREEN, order: 0 }}
                >
                  <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: GREEN, boxShadow: '0 0 8px rgba(69,179,125,0.8)' }} />
                  LIVE
                </span>
              )}
              {catchingUp && (
                <button onClick={stopPlayback} title="Stop the catch-up playback" style={{ ...toolBtnStyle(true, true), order: 1 }}>
                  <Pause size={13} weight="fill" /> Stop catch-up
                </button>
              )}
              {/* Overflow — tertiary actions behind one machined control */}
              <div ref={shareRef} style={{ position: 'relative', display: 'inline-flex', order: 4 }}>
                <button
                  onClick={() => openPanel(menuOpen || shareOpen ? null : 'menu')}
                  disabled={!active}
                  title="More — share channel, recording log, catch me up"
                  aria-label="More channel actions"
                  aria-expanded={menuOpen}
                  style={{ ...toolBtnStyle(menuOpen || shareOpen, !!active), padding: '0 9px' }}
                >
                  <DotsThree size={17} weight="bold" />
                  {unheardVoice.length > 0 && (
                    <span
                      title={`${unheardVoice.length} unheard voice clip${unheardVoice.length === 1 ? '' : 's'}`}
                      style={{
                        minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`, color: '#241500',
                        fontSize: 9.5, fontWeight: 900, fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {unheardVoice.length}
                    </span>
                  )}
                </button>
                {menuOpen && active && (
                  <div style={{ ...popoverStyle(236), padding: 8 }}>
                    <button onClick={() => openPanel('share')} style={menuItemStyle(true)}>
                      <ShareNetwork size={14} weight="bold" color={GOLD_HI} /> Share channel
                    </button>
                    <button onClick={() => { openPanel(null); setLogOpen(true); }} style={menuItemStyle(true)}>
                      <ClockCounterClockwise size={14} weight="bold" color={GOLD_HI} /> Recording log
                    </button>
                    <button
                      onClick={() => { if (unheardVoice.length) { openPanel(null); startCatchUp(); } }}
                      disabled={unheardVoice.length === 0}
                      title="Play every unheard voice clip in order, oldest first"
                      style={menuItemStyle(unheardVoice.length > 0)}
                    >
                      <FastForward size={14} weight="fill" color={unheardVoice.length ? GOLD_HI : FAINT} />
                      Catch me up{unheardVoice.length ? ` (${unheardVoice.length})` : ''}
                    </button>
                  </div>
                )}
                {shareOpen && active && (
                  <div
                    style={{
                      position: 'absolute', right: 0, top: 'calc(100% + 10px)', width: 350, zIndex: 50,
                      background: 'rgba(24,24,27,0.98)', border: `1px solid ${AMBER_BORDER}`,
                      borderRadius: 14, boxShadow: '0 22px 48px rgba(12,12,16,0.65)',
                      padding: 14, textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <ShareNetwork size={14} weight="bold" color={GOLD_HI} />
                      <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', color: GOLD_HI, whiteSpace: 'nowrap' }}>GUEST ACCESS</span>
                      <span style={{ fontSize: 11, color: FAINT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flex: 1 }}>{active.name}</span>
                      <button onClick={closeShare} aria-label="Close share panel" style={{ background: 'none', border: 'none', color: FAINT, cursor: 'pointer', padding: 2, display: 'inline-flex' }}>
                        <X size={14} weight="bold" />
                      </button>
                    </div>

                    {createdUrl && (
                      <div style={{ padding: 10, borderRadius: 10, background: GREEN_SOFT, border: `1px solid ${GREEN_BORDER}`, marginBottom: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.1em', color: GREEN, marginBottom: 5 }}>LINK READY — SEND IT TO YOUR GUEST</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: WHITE, overflowWrap: 'anywhere', lineHeight: 1.4 }}>{createdUrl}</span>
                          <button
                            onClick={() => copyShare('created', createdUrl)}
                            style={{ ...rowActionStyle, flexShrink: 0, color: copiedKey === 'created' ? GREEN : MUTED, borderColor: copiedKey === 'created' ? GREEN_BORDER : BORDER }}
                          >
                            {copiedKey === 'created' ? <Check size={11} weight="bold" /> : <Copy size={11} weight="bold" />} {copiedKey === 'created' ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    )}

                    <input
                      value={shareLabel}
                      onChange={(e) => setShareLabel(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') createGuestLink(); }}
                      placeholder="Label (e.g. Inspector Diaz)"
                      style={{
                        width: '100%', boxSizing: 'border-box', padding: '8px 11px',
                        background: FIELD_BG, border: FIELD_BORDER, borderRadius: 10,
                        color: WHITE, fontSize: 12.5, outline: 'none', marginBottom: 8,
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: MUTED, cursor: 'pointer', flex: 1, minWidth: 0, whiteSpace: 'nowrap' }}>
                        <input type="checkbox" checked={shareTalk} onChange={(e) => setShareTalk(e.target.checked)} style={{ accentColor: GOLD }} />
                        Guest can talk
                      </label>
                      <select
                        value={shareDays}
                        onChange={(e) => setShareDays(e.target.value as '7' | '30' | '90' | 'never')}
                        aria-label="Link expiry"
                        style={{ flexShrink: 0, padding: '6px 8px', background: FIELD_BG, border: FIELD_BORDER, borderRadius: 9, color: WHITE, fontSize: 11.5, outline: 'none' }}
                      >
                        <option value="7">Expires in 7 days</option>
                        <option value="30">Expires in 30 days</option>
                        <option value="90">Expires in 90 days</option>
                        <option value="never">No expiry</option>
                      </select>
                    </div>
                    <button
                      onClick={createGuestLink}
                      disabled={creatingLink}
                      className="pmBtn"
                      style={{ ...goldButtonStyle, width: '100%', padding: '9px 14px', fontSize: 12.5, opacity: creatingLink ? 0.6 : 1 }}
                    >
                      {creatingLink ? 'Creating…' : 'Create guest link'}
                    </button>
                    {shareError && <div style={{ fontSize: 11, color: RED, marginTop: 8 }}>{shareError}</div>}

                    <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 12, paddingTop: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.12em', color: FAINT, marginBottom: 8 }}>ACTIVE LINKS</div>
                      <div style={{ maxHeight: 190, overflowY: 'auto' }}>
                        {linksKey && !linkData && !linkError && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} height={34} borderRadius={10} />)}
                          </div>
                        )}
                        {linkError && <div style={{ fontSize: 11.5, color: RED }}>Could not load guest links. Close and reopen to retry.</div>}
                        {linkData && guestLinks.length === 0 && (
                          <div style={{ fontSize: 11.5, color: FAINT }}>No guest links yet — create one above.</div>
                        )}
                        {guestLinks.map((l) => {
                          const expired = !!l.expires_at && new Date(l.expires_at).getTime() < Date.now();
                          return (
                            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 10, background: NEST, border: `1px solid ${BORDER}`, marginBottom: 6 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 800, color: WHITE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {l.label || 'Guest link'}
                                </div>
                                <div style={{ fontSize: 10, color: expired ? RED : FAINT, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {l.can_talk === false ? 'Listen-only' : 'Talk + listen'}
                                  {' · '}
                                  {expired ? 'EXPIRED' : l.expires_at ? `expires ${new Date(l.expires_at).toLocaleDateString()}` : 'no expiry'}
                                </div>
                              </div>
                              {!expired && (
                                <button
                                  onClick={() => copyShare(l.id, guestAbsUrl(l.token))}
                                  title="Copy the guest link"
                                  style={{ ...rowActionStyle, color: copiedKey === l.id ? GREEN : MUTED, borderColor: copiedKey === l.id ? GREEN_BORDER : BORDER }}
                                >
                                  {copiedKey === l.id ? <Check size={11} weight="bold" /> : <Copy size={11} weight="bold" />} {copiedKey === l.id ? 'Copied' : 'Copy'}
                                </button>
                              )}
                              <button
                                onClick={() => revokeGuestLink(l.id)}
                                disabled={revokingId === l.id}
                                title="Revoke this link — the guest loses access immediately"
                                style={{ ...rowActionStyle, color: '#FCA5A5', borderColor: RED_BORDER, background: RED_SOFT, opacity: revokingId === l.id ? 0.6 : 1 }}
                              >
                                <Trash size={11} weight="bold" /> {revokingId === l.id ? 'Revoking…' : 'Revoke'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {/* People group — [Roster · Set handle] fused segments */}
              <div ref={rosterRef} style={{ position: 'relative', display: 'inline-flex', order: 2 }}>
                <div style={toolGroupStyle}>
                  <button
                    onClick={() => { pendingSelfEditRef.current = false; openPanel(rosterOpen ? null : 'roster'); }}
                    disabled={!active}
                    title="Channel roster — presence, call signs, add and remove members"
                    aria-expanded={rosterOpen}
                    style={toolSegStyle(rosterOpen, !!active, false)}
                  >
                    <UsersThree size={13} weight="bold" /> Roster
                  </button>
                  <button
                    onClick={() => { pendingSelfEditRef.current = true; openPanel('roster'); }}
                    disabled={!active}
                    title="Set your handle (call sign)"
                    style={toolSegStyle(false, !!active, true)}
                  >
                    <PencilSimple size={13} weight="bold" /> {myRosterRow?.call_sign ? `Handle: ${myRosterRow.call_sign}` : 'Set handle'}
                  </button>
                </div>
                {rosterOpen && active && (
                  <div
                    style={{
                      position: 'absolute', right: 0, top: 'calc(100% + 10px)', width: 330, zIndex: 50,
                      background: 'rgba(24,24,27,0.98)', border: `1px solid ${AMBER_BORDER}`,
                      borderRadius: 14, boxShadow: '0 22px 48px rgba(12,12,16,0.65)',
                      padding: 14, textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <UsersThree size={14} weight="bold" color={GOLD_HI} />
                      <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', color: GOLD_HI, whiteSpace: 'nowrap' }}>ROSTER</span>
                      <span style={{ fontSize: 11, color: FAINT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flex: 1 }}>{active.name}</span>
                      <button onClick={() => setRosterOpen(false)} aria-label="Close the roster" style={{ background: 'none', border: 'none', color: FAINT, cursor: 'pointer', padding: 2, display: 'inline-flex' }}>
                        <X size={14} weight="bold" />
                      </button>
                    </div>
                    {/* Add member — mini directory picker (staff + subs) */}
                    <div style={{ marginBottom: 10 }}>
                      {!rosterAddOpen ? (
                        <button
                          onClick={() => { setRosterAddOpen(true); setRosterAddQuery(''); }}
                          style={{ ...toolBtnStyle(false, true), width: '100%' }}
                        >
                          <UserPlus size={13} weight="bold" /> Add member
                        </button>
                      ) : (
                        <div style={{ padding: 8, borderRadius: 10, background: NEST, border: `1px solid ${BORDER}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <input
                              value={rosterAddQuery}
                              onChange={(e) => setRosterAddQuery(e.target.value)}
                              placeholder="Search staff and subs…"
                              autoFocus
                              style={{ ...fieldStyle, flex: 1, padding: '7px 10px', fontSize: 12 }}
                            />
                            <button onClick={() => setRosterAddOpen(false)} aria-label="Close the member picker" style={{ background: 'none', border: 'none', color: FAINT, cursor: 'pointer', padding: 2, display: 'inline-flex', flexShrink: 0 }}>
                              <X size={13} weight="bold" />
                            </button>
                          </div>
                          <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                            {renderDirectory({
                              query: rosterAddQuery,
                              mode: 'pick',
                              excludeUsers: rosterUserIds,
                              excludeSubs: rosterSubIds,
                              busyKey: memberBusy,
                              onRow: addMember,
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    <div style={{ maxHeight: 290, overflowY: 'auto' }}>
                      {rosterKey && !rosterData && !rosterError && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={40} borderRadius={10} />)}
                        </div>
                      )}
                      {rosterError && <div style={{ fontSize: 11.5, color: RED }}>Could not load the roster. Close and reopen to retry.</div>}
                      {rosterData && rosterMembers.length === 0 && (
                        <div style={{ fontSize: 11.5, color: FAINT }}>No members on this channel yet.</div>
                      )}
                      {rosterMembers.map((mem, idx) => {
                        const self = !!myUserId && mem.user_id === myUserId;
                        const pres = mem.presence_status ? PRESENCE[mem.presence_status] || null : null;
                        const onNow = !!mem.last_seen_at && Date.now() - new Date(mem.last_seen_at).getTime() <= 90_000;
                        return (
                          <div key={mem.user_id || idx} style={{ padding: '7px 9px', borderRadius: 10, background: self ? AMBER_SOFT : NEST, border: `1px solid ${self ? AMBER_BORDER : BORDER}`, marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span
                                aria-hidden
                                title={pres ? pres.label : 'No status set'}
                                style={{ flexShrink: 0, width: 9, height: 9, borderRadius: 999, background: pres ? pres.color : 'rgba(255,255,255,0.18)', boxShadow: onNow && pres ? `0 0 6px ${pres.color}` : undefined }}
                              />
                              <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 800, color: WHITE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {senderShort(mem.display_name)}{self ? ' (you)' : ''}
                              </span>
                              {mem.call_sign && (
                                <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 900, letterSpacing: '0.08em', color: GOLD_HI, border: `1px solid ${AMBER_BORDER}`, borderRadius: 999, padding: '1px 7px' }}>
                                  {mem.call_sign}
                                </span>
                              )}
                              {!self && !!mem.id && (removeArm === String(mem.id) ? (
                                <button
                                  onClick={() => removeMember(mem)}
                                  disabled={memberBusy === String(mem.id)}
                                  title="Confirm — remove this member from the channel"
                                  style={{ ...rowActionStyle, flexShrink: 0, color: '#FCA5A5', borderColor: RED_BORDER, background: RED_SOFT, opacity: memberBusy === String(mem.id) ? 0.6 : 1 }}
                                >
                                  {memberBusy === String(mem.id) ? 'Removing…' : 'Remove?'}
                                </button>
                              ) : (
                                <button
                                  onClick={() => setRemoveArm(String(mem.id))}
                                  title={`Remove ${senderShort(mem.display_name)} from this channel`}
                                  aria-label={`Remove ${senderShort(mem.display_name)} from this channel`}
                                  style={{ background: 'none', border: 'none', color: FAINT, cursor: 'pointer', padding: 2, display: 'inline-flex', flexShrink: 0 }}
                                >
                                  <X size={12} weight="bold" />
                                </button>
                              ))}
                              {self && !editingProfile && (
                                <button
                                  onClick={() => startEditProfile(mem)}
                                  title="Edit your call sign and status"
                                  aria-label="Edit your call sign and status"
                                  style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', padding: 2, display: 'inline-flex', flexShrink: 0 }}
                                >
                                  <PencilSimple size={12} weight="bold" />
                                </button>
                              )}
                            </div>
                            <div style={{ fontSize: 10, color: FAINT, marginTop: 2, paddingLeft: 17 }}>
                              {pres ? pres.label : 'No status'}
                              {mem.role === 'dispatcher' ? ' · dispatcher' : ''}
                              {onNow ? ' · on channel now' : mem.last_seen_at ? ` · seen ${timeOf(mem.last_seen_at)}` : ''}
                            </div>
                            {self && editingProfile && (
                              <div style={{ marginTop: 8 }}>
                                <input
                                  value={callSignDraft}
                                  onChange={(e) => setCallSignDraft(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') saveProfile(); }}
                                  placeholder="Call sign (e.g. UNIT 7)"
                                  maxLength={24}
                                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', background: FIELD_BG, border: FIELD_BORDER, borderRadius: 9, color: WHITE, fontSize: 12, outline: 'none', marginBottom: 7 }}
                                />
                                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                                  {(['available', 'busy', 'on_route', 'off'] as const).map((s) => (
                                    <button
                                      key={s}
                                      onClick={() => setStatusDraft(s)}
                                      style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 999, cursor: 'pointer',
                                        background: statusDraft === s ? AMBER_SOFT : FIELD_BG,
                                        border: statusDraft === s ? `1px solid ${AMBER_BORDER}` : FIELD_BORDER,
                                        color: statusDraft === s ? GOLD_HI : MUTED, fontSize: 10.5, fontWeight: 800,
                                      }}
                                    >
                                      <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: PRESENCE[s].color }} />
                                      {PRESENCE[s].label}
                                    </button>
                                  ))}
                                </div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <button
                                    onClick={saveProfile}
                                    disabled={savingProfile}
                                    className="pmBtn"
                                    style={{ ...goldButtonStyle, padding: '7px 12px', fontSize: 11.5, opacity: savingProfile ? 0.6 : 1 }}
                                  >
                                    {savingProfile ? 'Saving…' : 'Save'}
                                  </button>
                                  <button
                                    onClick={() => setEditingProfile(false)}
                                    style={{ background: 'none', border: 'none', color: FAINT, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              {/* Channel-bridging group — [Patch · Broadcast] fused segments */}
              <div ref={patchBcRef} style={{ position: 'relative', display: 'inline-flex', order: 3 }}>
                <div style={toolGroupStyle}>
                  <button
                    onClick={() => openPanel(patchOpen ? null : 'patch')}
                    title="Patch board — bridge two talkgroups until released"
                    aria-expanded={patchOpen}
                    style={toolSegStyle(patchOpen || patches.length > 0, true, false)}
                  >
                    <PlugsConnected size={13} weight="bold" /> Patch{patches.length ? ` (${patches.length})` : ''}
                  </button>
                  <button
                    onClick={() => openPanel(bcOpen ? null : 'broadcast')}
                    title="Broadcast — one message onto up to eight channels"
                    aria-expanded={bcOpen}
                    style={toolSegStyle(bcOpen, true, true)}
                  >
                    <Megaphone size={13} weight="bold" /> Broadcast
                  </button>
                </div>
                {patchOpen && (
                  <div style={popoverStyle(300)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <PlugsConnected size={14} weight="bold" color={GOLD_HI} />
                      <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', color: GOLD_HI, flex: 1 }}>PATCH BOARD</span>
                      <button onClick={() => setPatchOpen(false)} aria-label="Close the patch board" style={{ background: 'none', border: 'none', color: FAINT, cursor: 'pointer', padding: 2, display: 'inline-flex' }}>
                        <X size={14} weight="bold" />
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <select
                        value={patchA}
                        onChange={(e) => setPatchA(e.target.value)}
                        aria-label="First channel to patch"
                        style={{ ...fieldStyle, padding: '8px 10px', color: patchA ? WHITE : FAINT }}
                      >
                        <option value="">First channel…</option>
                        {channels.filter((c) => c.id !== patchB).map((c) => (
                          <option key={c.id} value={c.id}>{c.name}{c.project_name ? ` — ${c.project_name}` : ''}</option>
                        ))}
                      </select>
                      <select
                        value={patchB}
                        onChange={(e) => setPatchB(e.target.value)}
                        aria-label="Second channel to patch"
                        style={{ ...fieldStyle, padding: '8px 10px', color: patchB ? WHITE : FAINT }}
                      >
                        <option value="">Second channel…</option>
                        {channels.filter((c) => c.id !== patchA).map((c) => (
                          <option key={c.id} value={c.id}>{c.name}{c.project_name ? ` — ${c.project_name}` : ''}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => postPatch(patchA, patchB, false)}
                        disabled={!patchA || !patchB || patchBusy}
                        className="pmBtn"
                        style={{ ...goldButtonStyle, padding: '9px 14px', fontSize: 12.5, opacity: !patchA || !patchB || patchBusy ? 0.55 : 1 }}
                      >
                        <PlugsConnected size={13} weight="bold" /> {patchBusy ? 'Working…' : 'Patch channels'}
                      </button>
                      {patches.length > 0 ? (
                        <div style={{ marginTop: 2 }}>
                          <div style={{ ...eyebrowStyle, marginBottom: 6 }}>ACTIVE PATCHES</div>
                          {patches.map((p) => (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 10, background: NEST, border: `1px solid ${AMBER_BORDER}`, marginBottom: 6 }}>
                              <PlugsConnected size={13} weight="bold" color={GOLD_HI} style={{ flexShrink: 0 }} />
                              <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: 800, color: WHITE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {channelName(p.channel_a)} + {channelName(p.channel_b)}
                              </span>
                              <button
                                onClick={() => postPatch(p.channel_a, p.channel_b, true)}
                                disabled={patchBusy}
                                title="Release this patch — the channels stop mirroring"
                                style={{ ...rowActionStyle, color: '#FCA5A5', borderColor: RED_BORDER, background: RED_SOFT, opacity: patchBusy ? 0.6 : 1 }}
                              >
                                Release
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: FAINT }}>
                          Patch two talkgroups and their traffic mirrors both ways until released.
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {bcOpen && (
                  <div style={popoverStyle(340)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <Megaphone size={14} weight="bold" color={GOLD_HI} />
                      <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', color: GOLD_HI, flex: 1 }}>BROADCAST</span>
                      <span style={{ fontSize: 10, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: bcSel.size ? GOLD_HI : FAINT, border: `1px solid ${bcSel.size ? AMBER_BORDER : BORDER}`, borderRadius: 999, padding: '1px 8px' }}>
                        {bcSel.size}/8
                      </span>
                      <button onClick={() => setBcOpen(false)} aria-label="Close the broadcast composer" style={{ background: 'none', border: 'none', color: FAINT, cursor: 'pointer', padding: 2, display: 'inline-flex' }}>
                        <X size={14} weight="bold" />
                      </button>
                    </div>
                    {bcSent && (
                      <div style={{ padding: '8px 10px', borderRadius: 10, background: GREEN_SOFT, border: `1px solid ${GREEN_BORDER}`, marginBottom: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.1em', color: GREEN, marginBottom: 3 }}>
                          SENT TO {bcSent.length} CHANNEL{bcSent.length === 1 ? '' : 'S'}
                        </div>
                        <div style={{ fontSize: 11.5, color: WHITE, lineHeight: 1.5 }}>{bcSent.join(' · ')}</div>
                      </div>
                    )}
                    <div style={{ maxHeight: 176, overflowY: 'auto', marginBottom: 10, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 6 }}>
                      {channels.map((c) => {
                        const on = bcSel.has(c.id);
                        const full = !on && bcSel.size >= 8;
                        return (
                          <button
                            key={c.id}
                            onClick={() => toggleBcChannel(c.id)}
                            disabled={full}
                            title={full ? 'Eight channels max per broadcast' : undefined}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8, width: '100%', boxSizing: 'border-box',
                              padding: '5px 7px', borderRadius: 8, marginBottom: 2, textAlign: 'left',
                              background: on ? AMBER_SOFT : 'transparent',
                              border: on ? `1px solid ${AMBER_BORDER}` : '1px solid transparent',
                              color: WHITE, cursor: full ? 'default' : 'pointer', opacity: full ? 0.45 : 1,
                            }}
                          >
                            <span
                              aria-hidden
                              style={{
                                flexShrink: 0, width: 15, height: 15, borderRadius: 5,
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                background: on ? `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})` : FIELD_BG,
                                border: on ? 'none' : FIELD_BORDER, color: '#241500',
                              }}
                            >
                              {on && <Check size={10} weight="bold" />}
                            </span>
                            <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                            <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 800, color: FAINT, whiteSpace: 'nowrap', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {c.kind === 'direct' ? 'Direct' : c.project_name || (c.project_id ? 'Project' : 'Organization')}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <input
                      value={bcText}
                      onChange={(e) => setBcText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') sendBroadcast(); }}
                      placeholder="One message for every selected channel"
                      style={{ ...fieldStyle, marginBottom: 8 }}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: MUTED, cursor: 'pointer', marginBottom: 10 }}>
                      <input type="checkbox" checked={bcAlert} onChange={(e) => setBcAlert(e.target.checked)} style={{ accentColor: GOLD }} />
                      Send as high-visibility alert
                    </label>
                    <button
                      onClick={sendBroadcast}
                      disabled={bcSel.size < 2 || !bcText.trim() || bcBusy}
                      className="pmBtn"
                      style={{ ...goldButtonStyle, width: '100%', padding: '9px 14px', fontSize: 12.5, opacity: bcSel.size < 2 || !bcText.trim() || bcBusy ? 0.55 : 1 }}
                    >
                      <Megaphone size={13} weight="bold" /> {bcBusy ? 'Sending…' : bcSel.size >= 2 ? `Send to ${bcSel.size} channels` : 'Send broadcast'}
                    </button>
                    <div style={{ fontSize: 10.5, color: FAINT, marginTop: 8 }}>
                      Pick two to eight channels — the message lands on all of them at once.
                    </div>
                  </div>
                )}
              </div>
            </div>
          }
          flush
        >
          <div
            onDragEnter={onFeedDragEnter}
            onDragOver={onFeedDragOver}
            onDragLeave={onFeedDragLeave}
            onDrop={onFeedDrop}
            style={{ display: 'flex', flexDirection: 'column', height: 'min(680px, calc(100vh - 330px))', minHeight: 440, position: 'relative' }}
          >
            {/* Drag-drop target — pointer-events none so the drop lands on the container */}
            {dragOver && (
              <div
                aria-hidden
                style={{
                  position: 'absolute', inset: 8, zIndex: 30, pointerEvents: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  borderRadius: 14, border: `2px dashed ${AMBER_BORDER}`,
                  background: 'rgba(245,158,11,0.10)',
                  color: GOLD_HI, fontSize: 13, fontWeight: 800,
                }}
              >
                <Paperclip size={18} weight="bold" /> Drop to share on {active?.name || 'this channel'}
              </div>
            )}
            {/* Feed header — analog S/RF meter beside NOW TRANSMITTING / NOW PLAYING */}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px',
                background: onAir
                  ? 'linear-gradient(90deg, rgba(245,158,11,0.24), rgba(245,158,11,0.07))'
                  : 'rgba(255,255,255,0.02)',
                borderBottom: `1px solid ${onAir ? AMBER_BORDER : BORDER}`,
              }}
            >
              <SMeter mode={meterMode} level={meterLevel} width={116} />
              {onAir ? (
                <>
                  <EqBars color={recording ? RED : GOLD_HI} size={15} />
                  <span style={{ fontSize: 10.5, fontWeight: 900, letterSpacing: '0.14em', color: recording ? RED : GOLD_HI, whiteSpace: 'nowrap' }}>
                    {recording ? 'NOW TRANSMITTING' : 'NOW PLAYING'}
                  </span>
                  <span style={{ fontSize: 12, color: MUTED, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                    {recording
                      ? `You are keyed up on ${active?.name || 'this channel'} — release to send`
                      : `${senderShort(playingMsg?.sender_name ?? null)}${catchingUp ? ' · catch-up' : ''}${playingMsg?.audio_duration_secs ? ` · ${secsLabel(playingMsg.audio_duration_secs)}` : ''}`}
                  </span>
                  <span aria-hidden style={{ marginLeft: 'auto', flexShrink: 0 }}>
                    <EqBars color={recording ? RED : GOLD_HI} size={15} />
                  </span>
                </>
              ) : (
                <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', color: FAINT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                  {active ? `STANDING BY — ${active.name.toUpperCase()}` : 'STANDING BY'}
                </span>
              )}
            </div>

            {/* Traffic */}
            <div ref={feedRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 6px', display: 'flex', flexDirection: 'column' }}>
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
              {messages.map(renderRow)}
              {/* ── Standby radio face — the feed is never a black void ──── */}
              {standbyOn && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 300, maxWidth: 640, width: '100%', margin: '0 auto', paddingTop: messages.length ? 14 : 4, paddingBottom: 8 }}>
                  {/* Lockup */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', marginBottom: 14 }}>
                    <VividGoldChip icon={<Broadcast size={20} weight="fill" />} size={40} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 900, color: WHITE, letterSpacing: '-0.01em' }}>
                        Saguaro Radio — standing by
                      </div>
                      <div style={{ fontSize: 11.5, color: MUTED, marginTop: 1 }}>
                        {channels.length
                          ? `Monitoring ${stats.monitored} of ${stats.channels} talkgroup${stats.channels === 1 ? '' : 's'} — traffic appears here the moment anyone keys up.`
                          : 'No talkgroups yet — create your first channel and the band comes alive.'}
                      </div>
                    </div>
                  </div>
                  <FrequencyDial seed={activeId || 'saguaro'} />
                  {/* Last traffic across the band */}
                  {lastTraffic?.lastMessage && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 12px', marginTop: 12, borderRadius: 10, background: NEST, border: `1px solid ${BORDER}` }}>
                      <span style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: '0.12em', color: GOLD_HI, whiteSpace: 'nowrap' }}>LAST TRAFFIC</span>
                      <span style={{ fontSize: 12, color: WHITE, fontWeight: 700, minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {senderShort(lastTraffic.lastMessage.sender)} — {trafficPreview(lastTraffic.lastMessage)}
                      </span>
                      <span style={{ fontSize: 11, color: FAINT, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        {lastTraffic.name} · {whenLabel(lastTraffic.lastMessage.at)}
                      </span>
                    </div>
                  )}
                  {/* Channel guide — everything the rail knows, tappable */}
                  {channels.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.14em', color: FAINT }}>CHANNEL GUIDE</span>
                        <span style={{ fontSize: 10.5, color: FAINT }}>tap a channel to tune in</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
                        {channels.slice(0, 8).map((c, i) => {
                          const cur = c.id === activeId;
                          const unread = typeof c.unread === 'number' && c.unread > 0 ? c.unread : 0;
                          return (
                            <button
                              key={c.id}
                              onClick={() => setActiveId(c.id)}
                              title={`Tune to ${c.name}`}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px',
                                borderRadius: 11, cursor: 'pointer', textAlign: 'left',
                                background: cur ? 'linear-gradient(180deg, rgba(245,158,11,0.16), rgba(245,158,11,0.06))' : FIELD_BG,
                                border: cur ? `1px solid ${AMBER_BORDER}` : FIELD_BORDER,
                              }}
                            >
                              <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 900, letterSpacing: '0.08em', color: cur ? GOLD_HI : FAINT, fontVariantNumeric: 'tabular-nums', border: `1px solid ${cur ? AMBER_BORDER : BORDER}`, borderRadius: 7, padding: '3px 6px' }}>
                                CH {String(i + 1).padStart(2, '0')}
                              </span>
                              <span style={{ minWidth: 0, flex: 1 }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <span style={{ fontSize: 12.5, fontWeight: 800, color: WHITE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                                  {c.priority && <Star size={10} weight="fill" color={GOLD_HI} style={{ flexShrink: 0 }} />}
                                </span>
                                <span style={{ display: 'block', fontSize: 10.5, color: FAINT, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {c.members} member{c.members === 1 ? '' : 's'}
                                  {c.lastMessage?.at ? ` · last ${whenLabel(c.lastMessage.at)}` : ' · no traffic yet'}
                                </span>
                              </span>
                              {unread > 0 && (
                                <span style={{ flexShrink: 0, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`, color: '#241500', fontSize: 10, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
                                  {unread > 99 ? '99+' : unread}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {channels.length > 8 && (
                        <div style={{ fontSize: 10.5, color: FAINT, marginTop: 6 }}>+{channels.length - 8} more in the channel rail</div>
                      )}
                    </div>
                  )}
                  {/* Quick actions */}
                  <div style={{ marginTop: 'auto', paddingTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                      onClick={() => { pendingSelfEditRef.current = true; setRosterOpen(true); }}
                      disabled={!active}
                      title="Set your handle (call sign)"
                      style={{ ...goldOutlineButtonStyle, padding: '7px 14px', fontSize: 12, opacity: active ? 1 : 0.45, cursor: active ? 'pointer' : 'default' }}
                    >
                      <PencilSimple size={12} weight="bold" /> Set handle
                    </button>
                    <button
                      onClick={() => setShowNew(true)}
                      title="Start a new talkgroup"
                      style={{ ...goldOutlineButtonStyle, padding: '7px 14px', fontSize: 12 }}
                    >
                      <Plus size={12} weight="bold" /> New group
                    </button>
                    <button
                      onClick={() => setShareOpen(true)}
                      disabled={!active}
                      title="Share this channel with a guest — listen or talk, no account needed"
                      style={{ ...goldOutlineButtonStyle, padding: '7px 14px', fontSize: 12, opacity: active ? 1 : 0.45, cursor: active ? 'pointer' : 'default' }}
                    >
                      <ShareNetwork size={12} weight="bold" /> Share channel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Pending attachment — inline caption prompt before it transmits */}
            {(pendingFile || attachError) && (
              <div style={{ borderTop: `1px solid ${BORDER}`, padding: '10px 12px', background: NEST }}>
                {attachError && (
                  <div style={{ fontSize: 11.5, color: RED, marginBottom: pendingFile ? 8 : 0 }}>{attachError}</div>
                )}
                {pendingFile && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: 240,
                        padding: '6px 10px', borderRadius: 10, background: AMBER_SOFT,
                        border: `1px solid ${AMBER_BORDER}`, color: GOLD_HI, fontSize: 11.5, fontWeight: 800,
                      }}
                    >
                      <Paperclip size={12} weight="bold" style={{ flexShrink: 0 }} />
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pendingFile.name}</span>
                      <span style={{ color: FAINT, fontWeight: 700, flexShrink: 0 }}>{sizeLabel(pendingFile.size)}</span>
                    </span>
                    <input
                      value={mediaCaption}
                      onChange={(e) => setMediaCaption(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') sendMedia(); }}
                      placeholder="Add a caption (optional)"
                      autoFocus
                      style={{
                        flex: 1, minWidth: 160, boxSizing: 'border-box', padding: '8px 12px',
                        background: FIELD_BG, border: FIELD_BORDER, borderRadius: 10,
                        color: WHITE, fontSize: 12.5, outline: 'none',
                      }}
                    />
                    <button
                      onClick={sendMedia}
                      disabled={uploadingMedia}
                      className="pmBtn"
                      style={{ ...goldButtonStyle, padding: '8px 14px', fontSize: 12.5, opacity: uploadingMedia ? 0.6 : 1 }}
                    >
                      {uploadingMedia ? 'Sending…' : 'Send'}
                    </button>
                    <button
                      onClick={clearAttach}
                      disabled={uploadingMedia}
                      aria-label="Cancel attachment"
                      style={{ background: 'none', border: 'none', color: FAINT, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Composer */}
            <div style={{ borderTop: `1px solid ${BORDER}`, padding: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              {pttSupported && (
                <button
                  onPointerDown={pttStart}
                  onPointerUp={pttStop}
                  onPointerLeave={pttStop}
                  onPointerCancel={pttStop}
                  disabled={!active || uploadingVoice}
                  title="Hold to talk — release to transmit (or hold SPACE anywhere)"
                  aria-label="Hold to talk"
                  style={{
                    flexShrink: 0, width: 56, height: 42, borderRadius: 12, padding: 0,
                    display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
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
                  {uploadingVoice ? <Waveform size={17} weight="bold" /> : <Microphone size={17} weight="fill" />}
                  <span style={{ fontSize: 7.5, fontWeight: 900, letterSpacing: '0.16em', opacity: spaceKeyed || recording ? 1 : 0.65, lineHeight: 1 }}>
                    SPACE
                  </span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={MEDIA_ACCEPT}
                style={{ display: 'none' }}
                onChange={(e) => { const el = e.currentTarget; takeFile(el.files?.[0]); el.value = ''; }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!active || uploadingMedia}
                title="Attach a photo, PDF, or video to this channel"
                aria-label="Attach a file"
                style={{
                  flexShrink: 0, width: 42, height: 42, borderRadius: 12, padding: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: pendingFile ? AMBER_SOFT : FIELD_BG,
                  border: pendingFile ? `1px solid ${AMBER_BORDER}` : FIELD_BORDER,
                  color: pendingFile ? GOLD_HI : MUTED, cursor: active ? 'pointer' : 'not-allowed',
                  opacity: !active || uploadingMedia ? 0.55 : 1,
                }}
              >
                <Paperclip size={16} weight="bold" />
              </button>
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
              {/* Tone signaling — quick ACK / NEG / COME IN beeps */}
              <span style={{ flexShrink: 0, display: 'inline-flex', gap: 4 }}>
                {(['ack', 'negative', 'comein'] as const).map((tn) => (
                  <button
                    key={tn}
                    onClick={() => sendTone(tn)}
                    disabled={!active || toneSending !== null}
                    title={tn === 'ack' ? 'Send an ACK tone (affirmative)' : tn === 'negative' ? 'Send a NEGATIVE tone (denied / no)' : 'Send a COME IN tone (calling any unit)'}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                      background: TONES[tn].soft, border: `1px solid ${TONES[tn].border}`,
                      color: TONES[tn].color, fontWeight: 900, fontSize: 9.5, letterSpacing: '0.08em',
                      whiteSpace: 'nowrap',
                      opacity: !active || toneSending !== null ? 0.5 : 1,
                    }}
                  >
                    {tn === 'ack' ? 'ACK' : tn === 'negative' ? 'NEG' : 'COME IN'}
                  </button>
                ))}
              </span>
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

      {/* ── Recording console — date range + search + print-ready record ─ */}
      {logOpen && active && (
        <div
          className="sagRadioLogOverlay"
          onPointerDown={(e) => { if (e.target === e.currentTarget) setLogOpen(false); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 90,
            background: 'rgba(12,12,16,0.72)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            padding: '6vh 16px 16px', overflowY: 'auto',
          }}
        >
          <div
            style={{
              width: 'min(860px, 100%)', borderRadius: 16,
              background: 'rgba(24,24,27,0.98)', border: `1px solid ${AMBER_BORDER}`,
              boxShadow: '0 22px 48px rgba(12,12,16,0.65)', padding: 16,
            }}
          >
            {/* Controls — hidden when printing */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <ClockCounterClockwise size={16} weight="bold" color={GOLD_HI} />
              <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', color: GOLD_HI, whiteSpace: 'nowrap' }}>CHANNEL LOG</span>
              <span style={{ fontSize: 11, color: FAINT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flex: 1 }}>{active.name}</span>
              <button
                onClick={() => window.print()}
                title="Print or save this record as a PDF"
                style={{ ...goldOutlineButtonStyle, padding: '6px 12px', fontSize: 12 }}
              >
                <Printer size={12} weight="bold" /> Print / Export
              </button>
              <button onClick={() => setLogOpen(false)} aria-label="Close the channel log" style={{ background: 'none', border: 'none', color: FAINT, cursor: 'pointer', padding: 2, display: 'inline-flex' }}>
                <X size={15} weight="bold" />
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <div style={{ width: 150 }}>
                <SaguaroDatePicker value={logFrom} onChange={setLogFrom} placeholder="From date" />
              </div>
              <div style={{ width: 150 }}>
                <SaguaroDatePicker value={logTo} onChange={setLogTo} placeholder="To date" />
              </div>
              <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
                <MagnifyingGlass size={13} weight="bold" color={FAINT} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="Search text, transcripts, senders…"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px 9px 30px', background: FIELD_BG, border: FIELD_BORDER, borderRadius: 10, color: WHITE, fontSize: 12.5, outline: 'none' }}
                />
              </div>
            </div>

            {/* Print target — @media print lifts this to black-on-white */}
            <div id="sagRadioLogPrint">
              <div style={{ borderBottom: `1px solid ${BORDER}`, paddingBottom: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: WHITE }}>Saguaro Radio — channel record: {active.name}</div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>
                  {logFrom || logTo ? `Range ${logFrom || 'start'} to ${logTo || 'now'}` : 'Most recent traffic'}
                  {logSearch.trim() ? ` · filter \"${logSearch.trim()}\"` : ''}
                  {` · ${logRows.length} transmission${logRows.length === 1 ? '' : 's'}`}
                  {` · generated ${new Date().toLocaleString()}`}
                </div>
              </div>
              {logKey && !logData && !logError && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={30} borderRadius={8} />)}
                </div>
              )}
              {logError && <div style={{ fontSize: 12, color: RED }}>Could not load the record. Adjust the range and try again.</div>}
              {logData && logRows.length === 0 && (
                <div style={{ fontSize: 12, color: FAINT }}>No transmissions match this range and filter.</div>
              )}
              {logRows.map((m) => (
                <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '6px 2px', borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ flexShrink: 0, width: 148, fontSize: 11, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
                    {new Date(m.created_at).toLocaleString()}
                  </span>
                  <span style={{ flexShrink: 0, width: 120, fontSize: 11.5, fontWeight: 800, color: WHITE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {senderShort(m.sender_name)}
                  </span>
                  <span style={{ flexShrink: 0, width: 52, fontSize: 9.5, fontWeight: 900, letterSpacing: '0.08em', color: m.kind === 'panic' ? RED : m.kind === 'alert' ? GOLD_HI : FAINT }}>
                    {m.kind.toUpperCase()}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: WHITE, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
                    {logText(m)}
                    {m.patched_from ? ` (via ${channelName(m.patched_from)})` : ''}
                  </span>
                </div>
              ))}
              <div style={{ fontSize: 10, color: FAINT, marginTop: 8 }}>
                Newest 100 transmissions in range shown, oldest first. End of record.
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── Create group — name + project + member picker ────────────────── */}
      {showNew && (
        <div style={modalShellStyle} onPointerDown={(e) => { if (e.target === e.currentTarget) setShowNew(false); }}>
          <div style={modalCardStyle(470)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Plus size={15} weight="bold" color={GOLD_HI} />
              <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', color: GOLD_HI, flex: 1 }}>NEW TALKGROUP</span>
              <button onClick={() => setShowNew(false)} aria-label="Close" style={{ background: 'none', border: 'none', color: FAINT, cursor: 'pointer', padding: 2, display: 'inline-flex' }}>
                <X size={15} weight="bold" />
              </button>
            </div>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Channel name (e.g. Concrete crew)"
              autoFocus
              style={{ ...fieldStyle, fontSize: 13, marginBottom: 8 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <select
                value={newProject}
                onChange={(e) => setNewProject(e.target.value)}
                aria-label="Project for this talkgroup"
                style={{ ...fieldStyle, flex: 1, padding: '8px 10px' }}
              >
                <option value="">Organization-wide</option>
                {projectOptions.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, color: MUTED, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                <input type="checkbox" checked={newAllowSubs} onChange={(e) => setNewAllowSubs(e.target.checked)} style={{ accentColor: GOLD }} />
                Subs can join
              </label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={eyebrowStyle}>MEMBERS</span>
              <span style={{ fontSize: 10, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: newSel.length ? GOLD_HI : FAINT, border: `1px solid ${newSel.length ? AMBER_BORDER : BORDER}`, borderRadius: 999, padding: '1px 8px' }}>
                {newSel.length} selected
              </span>
              <span style={{ fontSize: 10.5, color: FAINT, flex: 1, textAlign: 'right' }}>You join automatically as dispatcher</span>
            </div>
            <input
              value={newQuery}
              onChange={(e) => setNewQuery(e.target.value)}
              placeholder="Search staff and subs…"
              style={{ ...fieldStyle, padding: '7px 10px', fontSize: 12, marginBottom: 6 }}
            />
            <div style={{ maxHeight: 210, overflowY: 'auto', border: `1px solid ${BORDER}`, borderRadius: 10, padding: 6, marginBottom: 12 }}>
              {renderDirectory({
                query: newQuery,
                mode: 'check',
                selectedKeys: new Set(newSel.map(personKey)),
                onRow: toggleNewPerson,
              })}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                onClick={createChannel}
                disabled={!newName.trim() || creating}
                className="pmBtn"
                style={{ ...goldButtonStyle, padding: '10px 18px', fontSize: 12.5, opacity: !newName.trim() || creating ? 0.6 : 1 }}
              >
                {creating ? 'Creating…' : newSel.length ? `Create + add ${newSel.length} member${newSel.length === 1 ? '' : 's'}` : 'Create channel'}
              </button>
              <button onClick={() => setShowNew(false)} style={{ background: 'none', border: 'none', color: FAINT, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Direct 1:1 — staff picker ───────────────────────────────────── */}
      {directOpen && (
        <div style={modalShellStyle} onPointerDown={(e) => { if (e.target === e.currentTarget) setDirectOpen(false); }}>
          <div style={modalCardStyle(420)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <ChatCircleText size={15} weight="bold" color={GOLD_HI} />
              <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', color: GOLD_HI, flex: 1 }}>MESSAGE SOMEONE</span>
              <button onClick={() => setDirectOpen(false)} aria-label="Close" style={{ background: 'none', border: 'none', color: FAINT, cursor: 'pointer', padding: 2, display: 'inline-flex' }}>
                <X size={15} weight="bold" />
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 10 }}>
              Pick a teammate — a private 1:1 channel opens (or re-opens) and the console tunes to it.
            </div>
            <input
              value={directQuery}
              onChange={(e) => setDirectQuery(e.target.value)}
              placeholder="Search staff…"
              autoFocus
              style={{ ...fieldStyle, marginBottom: 8 }}
            />
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {renderDirectory({
                query: directQuery,
                mode: 'pick',
                staffOnly: true,
                busyKey: directBusy,
                pickIcon: <ChatCircleText size={13} weight="bold" />,
                onRow: startDirect,
              })}
            </div>
            <div style={{ fontSize: 10.5, color: FAINT, marginTop: 10 }}>
              Direct channels are staff-to-staff. Reach subs through their project talkgroups.
            </div>
          </div>
        </div>
      )}

      {/* ── Lock / unlock confirm — dispatcher intent gate ──────────────── */}
      {lockConfirm && (
        <div style={modalShellStyle} onPointerDown={(e) => { if (e.target === e.currentTarget) setLockConfirm(null); }}>
          <div style={modalCardStyle(400)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              {lockConfirm.locked ? <LockOpen size={15} weight="bold" color={GOLD_HI} /> : <Lock size={15} weight="fill" color={GOLD_HI} />}
              <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', color: GOLD_HI, flex: 1 }}>
                {lockConfirm.locked ? 'UNLOCK CHANNEL' : 'LOCK CHANNEL'}
              </span>
              <button onClick={() => setLockConfirm(null)} aria-label="Close" style={{ background: 'none', border: 'none', color: FAINT, cursor: 'pointer', padding: 2, display: 'inline-flex' }}>
                <X size={15} weight="bold" />
              </button>
            </div>
            <div style={{ fontSize: 12.5, color: WHITE, lineHeight: 1.55, marginBottom: 14 }}>
              {lockConfirm.locked
                ? `Unlock "${lockConfirm.name}"? It becomes visible to the whole team again and teammates join on their next visit.`
                : `Lock "${lockConfirm.name}"? Only current members keep access — the channel disappears from everyone else's console until a dispatcher adds them from the roster.`}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                onClick={applyLock}
                disabled={lockBusy}
                className="pmBtn"
                style={{ ...goldButtonStyle, padding: '10px 18px', fontSize: 12.5, opacity: lockBusy ? 0.6 : 1 }}
              >
                {lockConfirm.locked ? <LockOpen size={13} weight="bold" /> : <Lock size={13} weight="fill" />}
                {lockBusy ? 'Working…' : lockConfirm.locked ? 'Unlock channel' : 'Lock channel'}
              </button>
              <button onClick={() => setLockConfirm(null)} style={{ background: 'none', border: 'none', color: FAINT, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toasts — honest result reporting, bottom-right ──────────────── */}
      {toasts.length > 0 && (
        <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 120, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 380 }}>
          {toasts.map((tst) => (
            <div
              key={tst.id}
              role="status"
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12,
                background: 'rgba(24,24,27,0.98)',
                border: `1px solid ${tst.tone === 'ok' ? GREEN_BORDER : RED_BORDER}`,
                boxShadow: '0 14px 34px rgba(12,12,16,0.6)',
                color: WHITE, fontSize: 12.5, fontWeight: 700, lineHeight: 1.45,
              }}
            >
              {tst.tone === 'ok'
                ? <Check size={14} weight="bold" color={GREEN} style={{ flexShrink: 0 }} />
                : <Warning size={14} weight="fill" color={RED} style={{ flexShrink: 0 }} />}
              <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{tst.text}</span>
            </div>
          ))}
        </div>
      )}
    </PremiumSurface>
  );
}
