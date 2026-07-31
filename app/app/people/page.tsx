'use client';
/**
 * People & Access — unified hub.
 * ONE nav home for the two people-shaped surfaces that used to be separate
 * sidebar items (and read as duplicate modules):
 *   • Directory     → workforce / HR crew records (employees, certs, pay,
 *                     assignments, incident history)  → <PeopleDirectory/>
 *   • Roles & Access → the RBAC platform: roles, permission matrix, user
 *                     assignments, invites, audit log → <AccessManager/>
 * A top segmented control switches between them; ?tab=access deep-links
 * straight to the access side (used by the /app/roles-permissions redirect
 * and the Settings tile).
 *
 * Presentation: dressed in the cinematic premium kit (PremiumSurface aurora +
 * ModuleHero) to match the Dashboard. The two child surfaces render inside the
 * surface unchanged. (The segmented switch is no longer position:sticky because
 * PremiumSurface's root is overflow:hidden, which nullifies sticky — the tab
 * chooser now sits at the top of the content like the rest of the kit.)
 */
import { useState, useEffect } from 'react';
import { UsersThree, ShieldCheck } from '@phosphor-icons/react';
import { PeopleDirectory } from '@/components/team/PeopleDirectory';
import { AccessManager } from '@/components/team/AccessManager';
import { PremiumSurface, ModuleHero } from '@/components/ui/premium';

// Kit-aligned literals (mirror components/ui/premium.tsx tokens)
const GOLD = '#F59E0B', GOLD_HI = '#FBBF24';
const MUTED = 'rgba(255,255,255,0.62)';
const FAINT = 'rgba(255,255,255,0.42)';

type Tab = 'directory' | 'access';

const TABS = [
  { key: 'directory' as const, label: 'Directory', sub: 'Crew & HR records', Icon: UsersThree },
  { key: 'access' as const, label: 'Roles & Access', sub: 'Users, roles & permissions', Icon: ShieldCheck },
];

export default function PeopleAccessHub() {
  // Default landing = Roles & Access (the RBAC platform). Directory is one tap away.
  const [tab, setTab] = useState<Tab>('access');

  // Deep-link support (?tab=directory|access) — read once on mount, client-only
  // so no prerender/Suspense requirement from useSearchParams.
  useEffect(() => {
    try {
      const t = new URLSearchParams(window.location.search).get('tab');
      if (t === 'directory') setTab('directory');
      else if (t === 'access') setTab('access');
    } catch { /* no-op */ }
  }, []);

  const select = (t: Tab) => {
    setTab(t);
    // keep the URL honest so refresh / share lands on the same tab
    try {
      const url = t === 'access' ? '/app/people?tab=access' : '/app/people';
      window.history.replaceState(null, '', url);
    } catch { /* no-op */ }
  };

  return (
    <PremiumSurface maxWidth={1180} pad="40px 20px 0">
      {/* ── cinematic header ── */}
      <ModuleHero
        eyebrow="Team"
        eyebrowIcon={<UsersThree size={13} weight="fill" color={GOLD} />}
        title="People &"
        accent="Access"
        subtitle="Two people surfaces in one home — your crew & HR records, and the full role-based access platform."
      />

      {/* ── unified segmented switch ── */}
      <div style={{ marginBottom: 26 }}>
        <div
          style={{
            display: 'inline-flex', flexWrap: 'wrap',
            background: 'linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.012))',
            border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14, padding: 5, gap: 5,
            boxShadow: '0 20px 50px -30px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          {TABS.map(({ key, label, sub, Icon }) => {
            const on = tab === key;
            return (
              <button
                key={key}
                onClick={() => select(key)}
                className="pmBtn"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10, textAlign: 'left',
                  border: 'none', cursor: 'pointer', borderRadius: 10, padding: '9px 16px',
                  background: on ? `linear-gradient(135deg, ${GOLD}, ${GOLD_HI})` : 'transparent',
                  color: on ? '#1A1206' : MUTED,
                  boxShadow: on ? '0 10px 26px -12px rgba(245,158,11,0.7)' : 'none',
                  transition: 'background .18s ease, color .18s ease',
                }}
              >
                <Icon size={20} weight={on ? 'fill' : 'regular'} />
                <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                  <span style={{ fontSize: 14, fontWeight: 800 }}>{label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: on ? 'rgba(26,18,6,0.72)' : FAINT }}>{sub}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── active surface ── */}
      {tab === 'directory' ? <PeopleDirectory /> : <AccessManager />}
    </PremiumSurface>
  );
}
