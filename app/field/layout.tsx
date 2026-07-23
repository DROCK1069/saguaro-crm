'use client';
/**
 * Saguaro Field — Mobile Shell
 * Supports both PWA and Capacitor native (iOS/Android).
 * Bottom nav: Home · Punch · Log · Photos · More
 */
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { House, Warning, NotePencil, Camera, SquaresFour, Bell } from '@phosphor-icons/react';
import { getQueueCount, getDeadLetterCount, replayQueue, purgeExpired } from '@/lib/field-db';
import {
  isNative,
  isIOS,
  isAndroid,
  hideSplash,
  setStatusBarDark,
  onNetworkChange,
  getNetworkStatus,
  onAndroidBack,
  onAppResume,
  hapticLight,
  hapticSelection,
  setupPushListeners,
  registerForPush,
} from '@/lib/native';

const GOLD   = '#F59E0B';
const DARK   = '#0d1117';
const BORDER = 'rgba(255,255,255,0.12)';
const TEXT   = '#FFFFFF';
const DIM    = '#CBD5E1';
const GREEN  = '#34C759';
const RED    = '#FF3B30';

const NAV = [
  { href: '/field',         label: 'Home',   PhIcon: House },
  { href: '/field/punch',   label: 'Punch',  PhIcon: Warning },
  { href: '/field/log',     label: 'Log',    PhIcon: NotePencil },
  { href: '/field/photos',  label: 'Photos', PhIcon: Camera },
  { href: '/field/more',    label: 'More',   PhIcon: SquaresFour },
];

// Full grouped module list for the slide-out menu (mirrors the dashboard's IA).
const MENU: { group: string; items: { href: string; label: string }[] }[] = [
  { group: 'Daily Work', items: [
    { href: '/field',          label: 'Field Hub' },
    { href: '/field/clock',    label: 'Clock In / Out' },
    { href: '/field/log',      label: 'Daily Log' },
    { href: '/field/punch',    label: 'Punch List' },
    { href: '/field/photos',   label: 'Photos' },
    { href: '/field/safety',   label: 'Safety' },
  ] },
  { group: 'Documents & Drawings', items: [
    { href: '/field/drawings',   label: 'Drawings' },
    { href: '/field/rfis',       label: 'RFIs' },
    { href: '/field/submittals', label: 'Submittals' },
    { href: '/field/docs',       label: 'Documents' },
    { href: '/field/inspect',    label: 'Inspections' },
  ] },
  { group: 'Coordination', items: [
    { href: '/field/schedule',      label: 'Schedule' },
    { href: '/field/deliveries',    label: 'Deliveries' },
    { href: '/field/change-orders', label: 'Change Orders' },
    { href: '/field/meetings',      label: 'Meetings' },
    { href: '/field/equipment',     label: 'Equipment' },
  ] },
  { group: 'Team', items: [
    { href: '/field/directory',   label: 'Directory' },
    { href: '/field/crew-map',    label: 'Crew Map' },
    { href: '/field/leaderboard', label: 'Leaderboard' },
  ] },
  { group: 'More', items: [
    { href: '/field/qr',   label: 'QR Scanner' },
    { href: '/field/more', label: 'All Field Tools →' },
    { href: '/app',        label: 'Full Dashboard (desktop) →' }, // end the field↔app silo: a way back to the full app
  ] },
];


export default function FieldLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [deadCount, setDeadCount] = useState(0);
  const [installEvent, setInstallEvent] = useState<Event | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [isIosWeb, setIsIosWeb] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [pushMsg, setPushMsg] = useState<{ title: string; body: string } | null>(null);
  const [projectName, setProjectName] = useState('');
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [activeProjectId, setActiveProjectId] = useState('');
  const native = isNative();

  // ── Capacitor + PWA boot ───────────────────────────────────────
  useEffect(() => {
    // 1. Status bar: dark content on dark bg
    setStatusBarDark().catch(() => {});

    // 2. Hide splash after layout is ready
    const splashTimer = setTimeout(() => hideSplash().catch(() => {}), 300);

    // 3. Service worker (PWA / web only)
    if (!native && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data?.type === 'SYNC_NOW') triggerSync();
      });
    }

    // 4. Purge stale offline queue items
    purgeExpired().catch(() => {});

    return () => clearTimeout(splashTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load active project for header ───────────────────────────
  useEffect(() => {
    fetch('/api/projects/list').then(r => r.ok ? r.json() : null).then(d => {
      const list = d?.projects || d?.data || [];
      if (list.length > 0) {
        setProjects(list);
        const stored = typeof window !== 'undefined' ? localStorage.getItem('sag_active_project') : null;
        const active = stored ? list.find((p: { id: string }) => p.id === stored) || list[0] : list[0];
        setActiveProjectId(active.id);
        setProjectName(active.name || 'Project');
        localStorage.setItem('sag_active_project', active.id);
      }
    }).catch(() => {});
  }, []);

  // ── Bridge the project context to the tool pages ─────────────────
  // Field tool pages read ?projectId= from the URL, but navigation (bottom nav,
  // menu, direct links) doesn't carry it — so every tool showed "No project
  // selected" even though the picker knows the active project. Inject it.
  useEffect(() => {
    if (!activeProjectId || typeof window === 'undefined') return;
    if (pathname === '/field' || pathname === '/field/') return; // home doesn't need it
    const params = new URLSearchParams(window.location.search);
    if (params.get('projectId')) return;
    params.set('projectId', activeProjectId);
    router.replace(`${pathname}?${params.toString()}`);
  }, [activeProjectId, pathname, router]);

  const switchProject = (id: string) => {
    const proj = projects.find(p => p.id === id);
    if (proj) {
      setActiveProjectId(proj.id);
      setProjectName(proj.name);
      localStorage.setItem('sag_active_project', proj.id);
      setShowProjectPicker(false);
      // Reload with the new projectId in the URL so the tool page actually
      // switches projects (a plain reload would keep the old ?projectId=).
      const url = new URL(window.location.href);
      url.searchParams.set('projectId', proj.id);
      window.location.href = url.toString();
    }
  };

  // ── Push notifications (native) ───────────────────────────────
  useEffect(() => {
    if (!native) return;
    // Register for push and wire foreground banner
    registerForPush().catch(() => {});
    const cleanup = setupPushListeners({
      onMessage: (title, body) => {
        setPushMsg({ title, body });
        setTimeout(() => setPushMsg(null), 5000);
      },
      onTap: (data) => {
        // Navigate based on push data
        if (data?.route) router.push(String(data.route));
      },
    });
    return cleanup;
  }, [native, router]);

  // ── Network detection ─────────────────────────────────────────
  useEffect(() => {
    // Initial state
    getNetworkStatus().then((s) => setOnline(s.connected)).catch(() => {});

    // Listen for changes (native uses @capacitor/network, web uses window events)
    const cleanup = onNetworkChange(setOnline);
    return cleanup;
  }, []);

  useEffect(() => {
    if (online && queueCount > 0) triggerSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  // ── Queue polling ──────────────────────────────────────────────
  useEffect(() => {
    refreshQueue();
    const id = setInterval(refreshQueue, 8000);
    return () => clearInterval(id);
  }, []);

  // ── Sync on app resume (native) ───────────────────────────────
  useEffect(() => {
    const cleanup = onAppResume(() => {
      refreshQueue();
      if (online) triggerSync();
    });
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  // ── Android back button ───────────────────────────────────────
  useEffect(() => {
    const cleanup = onAndroidBack(() => {
      if (pathname === '/field') {
        // Let Android handle app minimize on root
        return;
      }
      router.back();
    });
    return cleanup;
  }, [pathname, router]);

  // ── PWA install prompts (web only) ────────────────────────────
  useEffect(() => {
    if (native) return;
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua);
    setIsIosWeb(ios);
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);
    if (ios && !standalone) {
      // Persist dismissal across sessions (localStorage) so "Not now" means
      // never again — it was sessionStorage, re-popping on every visit.
      const dismissed = localStorage.getItem('sag_install_dismissed');
      if (!dismissed) setTimeout(() => setShowInstall(true), 8000);
    }
  }, [native]);

  useEffect(() => {
    if (native) return;
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e); // always capture so the Install button can fire the native prompt
      // Respect prior dismissal (was unconditional → re-popped on every Chrome/Android
      // visit and ignored "Not now"). Delay so it never covers the screen on load.
      if (typeof window !== 'undefined' && localStorage.getItem('sag_install_dismissed')) return;
      setTimeout(() => setShowInstall(true), 8000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [native]);

  const refreshQueue = async () => {
    try {
      setQueueCount(await getQueueCount());
      setDeadCount(await getDeadLetterCount());
    } catch { /* no IndexedDB */ }
  };

  const triggerSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try { await replayQueue(); await refreshQueue(); } finally { setSyncing(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncing]);

  const handleInstall = async () => {
    if (!installEvent) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (installEvent as any).prompt();
    setShowInstall(false);
    setInstallEvent(null);
  };

  const dismissInstall = () => {
    setShowInstall(false);
    localStorage.setItem('sag_install_dismissed', '1');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: DARK, color: TEXT, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', maxWidth: 480, margin: '0 auto' }}>

      {/* ── Header with project switcher ── */}
      <div style={{ background: 'rgba(15,23,42,0.92)', position: 'sticky', top: 0, zIndex: 50, borderBottom: `1px solid ${BORDER}`, paddingTop: `max(${native && isIOS() ? '44px' : '6px'}, env(safe-area-inset-top))` }}>
        {/* Top row: Logo + Status */}
        <div style={{ padding: '6px 14px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Back — on every field sub-page, so users can always step out to the prior page. */}
            {pathname !== '/field' && (
              <button onClick={() => { router.back(); hapticLight().catch(() => {}); }} aria-label="Back"
                style={{ background: 'none', border: 'none', padding: 4, marginLeft: -4, cursor: 'pointer', display: 'flex', alignItems: 'center', color: TEXT }}>
                <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
            )}
            <button onClick={() => { setShowMenu(true); hapticLight().catch(() => {}); }} aria-label="Menu"
              style={{ background: 'none', border: 'none', padding: 4, marginLeft: pathname !== '/field' ? 0 : -4, cursor: 'pointer', display: 'flex', alignItems: 'center', color: TEXT }}>
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><line x1={3} y1={6} x2={21} y2={6}/><line x1={3} y1={12} x2={21} y2={12}/><line x1={3} y1={18} x2={21} y2={18}/></svg>
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-96x96.png" alt="Saguaro" width={26} height={26} style={{ borderRadius: 6, border: '1px solid rgba(245, 158, 11,.2)' }} />
            <span style={{ fontWeight: 900, fontSize: 13, color: GOLD, letterSpacing: 1 }}>SAGUARO</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => { router.push('/field/sage'); hapticLight().catch(() => {}); }} aria-label="Ask Sage AI"
              style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(245, 158, 11,.12)', border: '1px solid rgba(245, 158, 11,.3)', borderRadius: 16, padding: '3px 10px', color: GOLD, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 6.9L21 11l-6.6 2.1L12 20l-2.4-6.9L3 11l6.6-2.1z"/></svg>
              Sage
            </button>
            {queueCount > 0 && (
              <button onClick={triggerSync} disabled={syncing || !online}
                style={{ background: online ? 'rgba(245, 158, 11,.12)' : 'rgba(239,68,68,.12)', border: `1px solid ${online ? 'rgba(245, 158, 11,.25)' : 'rgba(239,68,68,.25)'}`, borderRadius: 16, padding: '2px 8px', color: online ? GOLD : RED, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                <span style={{ display: 'inline-block', animation: syncing ? 'spin 1s linear infinite' : undefined }}>↻</span>
                {queueCount}
              </button>
            )}
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: online ? GREEN : RED, boxShadow: `0 0 4px ${online ? GREEN : RED}` }} />
          </div>
        </div>
        {/* Project switcher row */}
        <div style={{ padding: '0 14px 6px', position: 'relative' }}>
          <button onClick={() => { setShowProjectPicker(!showProjectPicker); hapticLight().catch(() => {}); }}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 6, width: '100%', cursor: 'pointer', color: TEXT }}>
            <span style={{ display: 'flex', alignItems: 'center' }}><House size={16} weight="duotone" color={GOLD} /></span>
            <span style={{ flex: 1, textAlign: 'left', fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {projectName || 'Select Project'}
            </span>
            <span style={{ fontSize: 10, color: DIM, transform: showProjectPicker ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
          </button>
          {/* Project dropdown */}
          {showProjectPicker && projects.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 14, right: 14, background: '#0F172A', border: `1px solid ${BORDER}`, borderRadius: 10, zIndex: 100, maxHeight: 240, overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,.6)' }}>
              {projects.map(p => (
                <button key={p.id} onClick={() => switchProject(p.id)}
                  style={{ width: '100%', padding: '10px 14px', background: p.id === activeProjectId ? 'rgba(245, 158, 11,.1)' : 'transparent', border: 'none', borderBottom: `1px solid rgba(255,255,255,0.12)`, color: p.id === activeProjectId ? GOLD : TEXT, fontSize: 13, fontWeight: p.id === activeProjectId ? 700 : 400, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {p.id === activeProjectId && <span style={{ fontSize: 10 }}>✓</span>}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Breadcrumb row — shows current page name */}
        {pathname !== '/field' && (
          <div style={{ padding: '0 14px 5px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: DIM }}>
            <button onClick={() => router.push('/field')} style={{ background: 'none', border: 'none', color: GOLD, fontSize: 11, cursor: 'pointer', padding: 0, fontWeight: 600 }}>Home</button>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>›</span>
            <span style={{ fontWeight: 600, color: TEXT, textTransform: 'capitalize' }}>
              {pathname.split('/').filter(Boolean).pop()?.replace(/-/g, ' ')}
            </span>
          </div>
        )}
      </div>

      {/* Click-away for project picker */}
      {showProjectPicker && <div onClick={() => setShowProjectPicker(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />}

      {/* ── Slide-out navigation menu (unified IA) ── */}
      {showMenu && (
        <>
          <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: 0, bottom: 0, left: 0, width: '84%', maxWidth: 340, background: '#0F172A', zIndex: 201, boxShadow: '4px 0 28px rgba(0,0,0,0.18)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 'calc(14px + env(safe-area-inset-top)) 18px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/icon-96x96.png" alt="" width={30} height={30} style={{ borderRadius: 7 }} />
                <span style={{ fontWeight: 900, fontSize: 16, color: GOLD, letterSpacing: 1 }}>SAGUARO</span>
              </div>
              <button onClick={() => setShowMenu(false)} aria-label="Close menu" style={{ background: 'none', border: 'none', fontSize: 26, color: DIM, cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
            </div>

            <div style={{ padding: '14px 14px 4px' }}>
              <button onClick={() => { setShowMenu(false); router.push('/field/sage'); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, background: 'linear-gradient(135deg,#F59E0B,#FBBF24)', border: 'none', borderRadius: 14, padding: '13px 15px', cursor: 'pointer', boxShadow: '0 3px 12px rgba(245, 158, 11,.3)' }}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="#fff"><path d="M12 2l2.4 6.9L21 11l-6.6 2.1L12 20l-2.4-6.9L3 11l6.6-2.1z" /></svg>
                <span style={{ flex: 1, textAlign: 'left' }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: '#fff' }}>Ask Sage AI</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'rgba(255,255,255,.9)', marginTop: 1 }}>Your built-in construction assistant</span>
                </span>
              </button>
            </div>

            {MENU.map(sec => (
              <div key={sec.group} style={{ padding: '6px 8px' }}>
                <div style={{ padding: '8px 12px 4px', fontSize: 11, fontWeight: 700, color: DIM, letterSpacing: 0.6, textTransform: 'uppercase' }}>{sec.group}</div>
                {sec.items.map(it => {
                  const active = pathname === it.href;
                  return (
                    <button key={it.href} onClick={() => { setShowMenu(false); router.push(it.href); }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', background: active ? 'rgba(245, 158, 11,.1)' : 'none', border: 'none', borderRadius: 10, padding: '11px 14px', cursor: 'pointer', textAlign: 'left', color: active ? GOLD : TEXT, fontSize: 14.5, fontWeight: active ? 700 : 500 }}>
                      {it.label}
                    </button>
                  );
                })}
              </div>
            ))}
            <div style={{ height: 'calc(20px + env(safe-area-inset-bottom))' }} />
          </div>
        </>
      )}

      {/* ── Inline push notification banner (native foreground) ── */}
      {pushMsg && (
        <div style={{ background: 'rgba(245, 158, 11,.12)', borderBottom: '1px solid rgba(245, 158, 11,.3)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'flex', alignItems: 'center' }}><Bell size={18} weight="duotone" color={GOLD} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: GOLD }}>{pushMsg.title}</p>
            <p style={{ margin: 0, fontSize: 12, color: DIM }}>{pushMsg.body}</p>
          </div>
          <button onClick={() => setPushMsg(null)} style={{ background: 'none', border: 'none', color: DIM, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* ── PWA install modal — web only ── */}
      {showInstall && !isStandalone && !native && (
        <>
          <div onClick={dismissInstall} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 200 }} />
          <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#0F172A', borderRadius: '20px 20px 0 0', border: '1px solid rgba(245, 158, 11,.22)', borderBottom: 'none', paddingBottom: 'calc(20px + env(safe-area-inset-bottom))', zIndex: 201, boxShadow: '0 -10px 48px rgba(0,0,0,0.7)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
              <div style={{ width: 38, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 24px 0' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/icon-192x192.png" alt="Saguaro Field" width={72} height={72} style={{ borderRadius: 18, border: '2px solid rgba(245, 158, 11,.45)', boxShadow: '0 4px 24px rgba(245, 158, 11,.28)' }} />
              <h2 style={{ margin: '12px 0 4px', fontSize: 22, fontWeight: 900, color: TEXT, letterSpacing: -0.5, textAlign: 'center' }}>Install Saguaro Field</h2>
              <p style={{ margin: 0, fontSize: 14, color: DIM, textAlign: 'center', lineHeight: 1.4 }}>
                Your crew&apos;s field app — home screen access,<br />instant launch, works without signal.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, padding: '14px 24px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {['Works offline', 'GPS clock-in', 'Instant photos'].map((b) => (
                <span key={b} style={{ background: 'rgba(245, 158, 11,.12)', border: '1px solid rgba(245, 158, 11,.28)', borderRadius: 20, padding: '4px 13px', fontSize: 12, fontWeight: 700, color: GOLD }}>{b}</span>
              ))}
            </div>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 24px' }} />
            {isIosWeb ? (
              <div style={{ padding: '16px 24px 0' }}>
                <p style={{ margin: '0 0 14px', fontSize: 13, color: DIM, textAlign: 'center', fontWeight: 600 }}>3 steps in Safari — 15 seconds</p>
                {[
                  { Icon: <ShareIcon />, label: 'Tap the Share button', sub: 'Bottom of Safari — box with arrow icon' },
                  { Icon: <HomeAddIcon />, label: 'Tap "Add to Home Screen"', sub: 'Scroll down in the share sheet' },
                  { Icon: <CheckIcon />, label: 'Tap "Add" — you\'re done', sub: 'App icon appears on your home screen' },
                ].map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 16, alignItems: 'center' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(245, 158, 11,.13)', border: '1.5px solid rgba(245, 158, 11,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: GOLD }}>{step.Icon}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{step.label}</div>
                      <div style={{ fontSize: 12, color: DIM, marginTop: 2 }}>{step.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '20px 24px 0' }}>
                <button onClick={handleInstall} style={{ width: '100%', background: 'linear-gradient(135deg, #F59E0B 0%, #EF8C1A 100%)', border: 'none', borderRadius: 14, padding: '16px', color: '#000', fontSize: 17, fontWeight: 900, cursor: 'pointer', boxShadow: '0 6px 28px rgba(245, 158, 11,.5)' }}>
                  Install App
                </button>
                <p style={{ margin: '9px 0 0', textAlign: 'center', fontSize: 12, color: DIM }}>Takes 2 seconds · Works like a native app</p>
              </div>
            )}
            <div style={{ padding: '14px 24px 0', textAlign: 'center' }}>
              <button onClick={dismissInstall} style={{ background: 'none', border: 'none', color: DIM, fontSize: 14, cursor: 'pointer', padding: '8px 20px' }}>Not now</button>
            </div>
          </div>
        </>
      )}

      {/* ── Offline banner ── */}
      {!online && (
        <div style={{ background: 'rgba(239,68,68,.1)', borderBottom: '1px solid rgba(239,68,68,.2)', padding: '7px 16px', textAlign: 'center', fontSize: 13, color: RED, fontWeight: 600 }}>
          Offline — changes will sync when reconnected
        </div>
      )}

      {/* ── Dead-letter alert ── */}
      {deadCount > 0 && (
        <div style={{ background: 'rgba(245,158,11,.1)', borderBottom: '1px solid rgba(245,158,11,.3)', padding: '7px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: GOLD }}>
          <span style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Warning size={14} weight="fill" /> {deadCount} item{deadCount > 1 ? 's' : ''} failed to sync after 5 attempts</span>
          <span style={{ color: DIM, fontSize: 11 }}>Contact support</span>
        </div>
      )}

      <main style={{ flex: 1, overflowY: 'auto', paddingBottom: `calc(${native && isAndroid() ? '72px' : '64px'} + env(safe-area-inset-bottom))` }}>
        {children}
      </main>

      {/* ── Bottom nav ── */}
      <nav style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.12)', display: 'flex', paddingBottom: 'env(safe-area-inset-bottom)', zIndex: 50 }}>
        {NAV.map(({ href, label, PhIcon }) => {
          const active = href === '/field' ? pathname === '/field' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => { hapticSelection().catch(() => {}); }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '10px 4px 8px', color: active ? GOLD : DIM, textDecoration: 'none', position: 'relative', minHeight: 54 }}
            >
              {active && <span style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 28, height: 2.5, background: GOLD, borderRadius: '0 0 3px 3px' }} />}
              <PhIcon size={22} weight={active ? 'fill' : 'duotone'} color={active ? GOLD : DIM} />
              <span style={{ fontSize: 11, fontWeight: active ? 800 : 500, letterSpacing: 0.1 }}>{label}</span>
            </Link>
          );
        })}
      </nav>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        input, select, textarea, button { font-family: inherit; }
        ::-webkit-scrollbar { display: none; }
        textarea { resize: vertical; }
      `}</style>
    </div>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────

function ShareIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>;
}
function HomeAddIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><line x1="12" y1="12" x2="12" y2="18"/><line x1="9" y1="15" x2="15" y2="15"/></svg>;
}
function CheckIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}
function HomeIcon({ active }: { active: boolean }) {
  return <svg width="25" height="25" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>{!active&&<polyline points="9 22 9 12 15 12 15 22"/>}</svg>;
}
function PunchIcon({ active }: { active: boolean }) {
  return <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" fill={active ? 'currentColor' : 'none'}/><line x1="12" y1="8" x2="12" y2="12" stroke={active?'#0d1117':'currentColor'} strokeWidth="2.5"/><line x1="12" y1="16" x2="12.01" y2="16" stroke={active?'#0d1117':'currentColor'} strokeWidth="3"/></svg>;
}
function LogIcon({ active }: { active: boolean }) {
  return <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill={active?'currentColor':'none'}/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13" stroke={active?'#0d1117':'currentColor'}/><line x1="16" y1="17" x2="8" y2="17" stroke={active?'#0d1117':'currentColor'}/></svg>;
}
function CameraIcon({ active }: { active: boolean }) {
  return <svg width="25" height="25" viewBox="0 0 24 24" fill={active?'currentColor':'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4" fill={active?'#0d1117':'none'}/></svg>;
}
function GridIcon({ active }: { active: boolean }) {
  return <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" fill={active?'currentColor':'none'}/><rect x="14" y="3" width="7" height="7" fill={active?'currentColor':'none'}/><rect x="3" y="14" width="7" height="7" fill={active?'currentColor':'none'}/><rect x="14" y="14" width="7" height="7" fill={active?'currentColor':'none'}/></svg>;
}

