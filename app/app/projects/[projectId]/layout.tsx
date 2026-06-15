'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';

const GOLD = '#C8881C'; const DARK = '#F2F2F7'; const RAISED = '#FFFFFF';
const BORDER = '#E5E5EA'; const DIM = '#6E6E73'; const TEXT = '#1C1C1E';

// ALL sidebar nav items — every module Buildertrend has + more
const NAV_SECTIONS = [
  {
    label: 'PROJECT',
    items: [
      { label: 'Overview',        href: '',                   icon: '◈', badge: null },
      { label: 'Takeoff',         href: '/takeoff',           icon: '📐', badge: null },
      { label: 'Estimate',        href: '/estimate',          icon: '🧮', badge: null },
      { label: 'Proposal',        href: '/proposal',          icon: '📑', badge: null },
    ],
  },
  {
    label: 'EXECUTION',
    items: [
      { label: 'Schedule',              href: '/schedule',          icon: '📅', badge: null },
      { label: 'Bid Packages',          href: '/bid-packages',      icon: '📬', badge: null },
      { label: 'Selections & Allowances', href: '/selections',      icon: '🎨', badge: null },
      { label: 'Contracts',             href: '/contracts',         icon: '📋', badge: null },
      { label: 'PO & Subcontracts',     href: '/purchase-orders',   icon: '📝', badge: null },
    ],
  },
  {
    label: 'FINANCIAL',
    items: [
      { label: 'Budget',          href: '/budget',            icon: '💰', badge: null },
      { label: 'Change Orders',   href: '/change-orders',     icon: '🔄', badge: '2'  },
      { label: 'Pay Applications', href: '/pay-apps',         icon: '💵', badge: null },
      { label: 'Client Invoices', href: '/invoices',          icon: '🧾', badge: null },
      { label: 'Bills',           href: '/bills',             icon: '📄', badge: null },
      { label: 'Lien Waivers',    href: '/lien-waivers',      icon: '🔏', badge: null },
      { label: 'Insurance',       href: '/insurance',         icon: '🛡️',  badge: null },
      { label: 'Certified Payroll', href: '/payroll',         icon: '👷', badge: null },
      { label: 'W-9 Requests',    href: '/w9',                icon: '📝', badge: null },
    ],
  },
  {
    label: 'FIELD',
    items: [
      { label: 'Daily Logs',      href: '/daily-logs',        icon: '📋', badge: null },
      { label: 'Photos',          href: '/photos',            icon: '📷', badge: null },
      { label: 'Inspections',     href: '/inspections',       icon: '🔍', badge: null },
      { label: 'Safety',          href: '/safety',            icon: '🦺', badge: null },
      { label: 'Punch List',      href: '/punch-list',        icon: '✅', badge: null },
      { label: 'To-Dos',          href: '/todos',             icon: '☑️',  badge: null },
      { label: 'Timesheets',      href: '/timesheets',        icon: '⏱️',  badge: null },
    ],
  },
  {
    label: 'COMMUNICATION',
    items: [
      { label: 'RFIs',            href: '/rfis',              icon: '❓', badge: '2'  },
      { label: 'Submittals',      href: '/submittals',        icon: '📤', badge: null },
      { label: 'Messages',        href: '/messages',          icon: '💬', badge: null },
    ],
  },
  {
    label: 'DOCUMENTS',
    items: [
      { label: 'Files',           href: '/files',             icon: '📁', badge: null },
      { label: 'Drawings',        href: '/drawings',          icon: '📐', badge: null },
      { label: 'Permits',         href: '/permits',           icon: '🏛️',  badge: null },
      { label: 'Specifications',  href: '/specs',             icon: '📖', badge: null },
      { label: 'Closeout',        href: '/closeout',          icon: '✅', badge: null },
    ],
  },
  {
    label: 'TEAM',
    items: [
      { label: 'Team',            href: '/team',              icon: '👥', badge: null },
      { label: 'Compliance',      href: '/compliance',        icon: '🛡️',  badge: null },
    ],
  },
  {
    label: 'LOW VOLTAGE / IT',
    items: [
      { label: 'Network',          href: '/network',            icon: '🌐', badge: null },
      { label: 'Devices',          href: '/network/devices',    icon: '💻', badge: null },
      { label: 'VLANs',            href: '/network/vlans',      icon: '🔀', badge: null },
      { label: 'Cables',           href: '/network/cables',     icon: '🔌', badge: null },
      { label: 'Firewall',         href: '/network/firewall',   icon: '🛡️',  badge: null },
      { label: 'WiFi',             href: '/network/wifi',       icon: '📡', badge: null },
      { label: 'Config Gen',       href: '/network/config',     icon: '⚙️',  badge: null },
      { label: 'AI Wizard',        href: '/network/wizard',     icon: '🤖', badge: null },
      { label: 'Reports',          href: '/network/reports',    icon: '📊', badge: null },
    ],
  },
  {
    label: 'AI',
    items: [
      { label: 'Autopilot Alerts', href: '/autopilot',       icon: '🤖', badge: '3'  },
      { label: 'Bid Intelligence', href: '/intelligence',    icon: '🧠', badge: null },
    ],
  },
];

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const projectId = params['projectId'] as string;
  const base = `/app/projects/${projectId}`;
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectNumber, setProjectNumber] = useState('');
  const [pctComplete, setPctComplete] = useState(0);

  // Close mobile module menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}`)
      .then(r => r.json())
      .then(d => {
        if (d.project) {
          setProjectName(d.project.name || '');
          setProjectNumber(d.project.project_number || '');
          const billed = d.project.totalBilledToDate || 0;
          const contract = d.project.contractSumToDate || d.project.contract_amount || 1;
          setPctComplete(parseFloat(((billed / contract) * 100).toFixed(1)));
        }
      })
      .catch(() => {});
  }, [projectId]);

  const isActive = (href: string) => {
    const full = base + href;
    if (href === '') return pathname === base;
    return pathname.startsWith(full);
  };

  // Shared sidebar contents — rendered by both the desktop <aside> and the
  // mobile slide-over overlay. `isCollapsed` only ever true on desktop; the
  // mobile overlay always renders fully expanded.
  const renderSidebarBody = (isCollapsed: boolean) => (
    <>
      {/* Project header */}
      <div style={{ padding: '14px 12px', borderBottom: `1px solid ${BORDER}` }}>
        {!isCollapsed && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 2, lineHeight: 1.3 }}>{projectName || '—'}</div>
            <div style={{ fontSize: 10, color: DIM, marginBottom: 8 }}>{projectNumber}</div>
            {/* Progress */}
            <div style={{ height: 3, background: 'rgba(255,255,255,.08)', borderRadius: 2, marginBottom: 3 }}>
              <div style={{ height: '100%', width: `${pctComplete}%`, background: `linear-gradient(90deg,${GOLD},#E0A030)`, borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: 10, color: DIM }}>{pctComplete}% complete</div>
          </>
        )}
        <button onClick={() => setCollapsed(!collapsed)} style={{ marginTop: isCollapsed ? 0 : 8, background: 'none', border: 'none', color: DIM, cursor: 'pointer', fontSize: 16, padding: 0, display: 'block' }}>
          {isCollapsed ? '→' : '←'}
        </button>
      </div>

      {/* Nav sections */}
      {NAV_SECTIONS.map(section => (
        <div key={section.label} style={{ padding: '8px 0' }}>
          {!isCollapsed && (
            <div style={{ padding: '4px 12px 2px', fontSize: 9, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: '#6E6E73' }}>
              {section.label}
            </div>
          )}
          {section.items.map(item => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={base + item.href}
                title={isCollapsed ? item.label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: isCollapsed ? '8px 16px' : '7px 12px',
                  color: active ? GOLD : DIM,
                  background: active ? 'rgba(212,160,23,.08)' : 'transparent',
                  borderLeft: `2px solid ${active ? GOLD : 'transparent'}`,
                  fontSize: 12.5,
                  fontWeight: active ? 700 : 500,
                  textDecoration: 'none',
                  transition: 'all .1s',
                  position: 'relative',
                }}
              >
                <span style={{ fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
                {!isCollapsed && <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
                {!isCollapsed && item.badge && (
                  <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 8, background: active ? GOLD : '#B85C2A', color: '#F2F2F7' }}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}

      {/* Back to projects */}
      <div style={{ padding: '8px 12px', borderTop: `1px solid ${BORDER}`, marginTop: 8 }}>
        <Link href="/app/projects" style={{ display: 'flex', alignItems: 'center', gap: 8, color: DIM, fontSize: 12, textDecoration: 'none' }}>
          <span>←</span>{!isCollapsed && <span>All Projects</span>}
        </Link>
      </div>
    </>
  );

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 56px)' }}>

      {/* ── Responsive: hide desktop sidebar, expose mobile menu trigger ── */}
      <style>{`
        @media (max-width: 768px) {
          .sidebar-desktop { display: none !important; }
          .project-mobile-bar { display: flex !important; }
        }
      `}</style>

      {/* ── Project Sidebar (Desktop) ────────────────────────────────── */}
      <aside className="sidebar-desktop" style={{
        width: collapsed ? 56 : 220,
        flexShrink: 0,
        background: '#F2F2F7',
        borderRight: `1px solid ${BORDER}`,
        position: 'sticky',
        top: 56,
        height: 'calc(100vh - 56px)',
        overflowY: 'auto',
        overflowX: 'hidden',
        transition: 'width .2s',
        scrollbarWidth: 'thin',
      }}>
        {renderSidebarBody(collapsed)}
      </aside>

      {/* ── Page Content ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, background: '#F2F2F7' }}>

        {/* Mobile module bar — only shown <=768px (hidden on desktop) */}
        <div className="project-mobile-bar" style={{
          display: 'none',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
          background: '#F2F2F7',
          borderBottom: `1px solid ${BORDER}`,
          position: 'sticky',
          top: 56,
          zIndex: 90,
        }}>
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open project menu"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: RAISED,
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              color: TEXT,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 700,
              padding: '7px 12px',
            }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ width: 16, height: 2, background: GOLD, borderRadius: 1 }} />
              <span style={{ width: 16, height: 2, background: GOLD, borderRadius: 1 }} />
              <span style={{ width: 16, height: 2, background: GOLD, borderRadius: 1 }} />
            </span>
            Modules
          </button>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{projectName || '—'}</div>
            {projectNumber && <div style={{ fontSize: 10, color: DIM }}>{projectNumber}</div>}
          </div>
        </div>

        {children}
      </div>

      {/* ── Project Sidebar (Mobile Slide-over Overlay) ──────────────── */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setMobileOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 199 }}
          />
          {/* Panel */}
          <aside style={{
            position: 'fixed',
            top: 0,
            left: 0,
            bottom: 0,
            width: 250,
            maxWidth: '82vw',
            background: '#F2F2F7',
            borderRight: `1px solid ${BORDER}`,
            overflowY: 'auto',
            overflowX: 'hidden',
            zIndex: 200,
            scrollbarWidth: 'thin',
          }}>
            {/* Close row */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 10px 0' }}>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close project menu"
                style={{ background: 'none', border: 'none', color: DIM, cursor: 'pointer', fontSize: 24, lineHeight: 1, padding: '2px 6px' }}
              >
                ×
              </button>
            </div>
            {renderSidebarBody(false)}
          </aside>
        </>
      )}
    </div>
  );
}
