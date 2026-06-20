'use client';
/**
 * AppTopBar — Slim header with breadcrumbs, search, notifications, user menu.
 * Sits to the right of the sidebar.
 */
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  MagnifyingGlass,
  Bell,
  Star,
  CaretRight,
  CaretLeft,
  SignOut,
  UserCircle,
  GearSix,
  List,
} from '@phosphor-icons/react';
import { font, radius, sidebar as sidebarTokens, z } from '../lib/design-tokens';

/* ── Breadcrumb Labels ─────────────────────────────────────────────── */
const LABELS: Record<string, string> = {
  app: 'Home',
  projects: 'Projects',
  bids: 'Bids & Estimates',
  takeoff: 'AI Takeoff',
  documents: 'Documents',
  autopilot: 'Autopilot',
  reports: 'Reports',
  intelligence: 'Intelligence',
  field: 'Field App',
  portals: 'Portals',
  billing: 'Billing',
  compliance: 'Compliance',
  settings: 'Settings',
  invoicing: 'Invoicing',
  'daily-logs': 'Daily Logs',
  schedule: 'Schedule',
  customers: 'Customers',
};

export default function AppTopBar({
  sidebarCollapsed,
  onToggleSidebar,
  onOpenSage,
  onOpenCommandPalette,
  onLogout,
  userInitials,
}: {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenSage: () => void;
  onOpenCommandPalette: () => void;
  onLogout: () => void;
  userInitials: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const sidebarWidth = sidebarCollapsed ? sidebarTokens.widthCollapsed : sidebarTokens.width;

  /* ── Breadcrumbs ─────────────────────────────────────────────────── */
  const segments = pathname.split('/').filter(Boolean);
  const crumbs = segments.map((seg, i) => ({
    label: LABELS[seg] || (seg.length > 20 ? seg.slice(0, 12) + '...' : seg.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())),
    href: '/' + segments.slice(0, i + 1).join('/'),
    isLast: i === segments.length - 1,
  }));

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: sidebarWidth,
        right: 0,
        height: sidebarTokens.headerHeight,
        background: 'rgba(255,255,255,0.8)',
        borderBottom: '1px solid #E5E5EA',
        backdropFilter: 'blur(16px) saturate(140%)',
        WebkitBackdropFilter: 'blur(16px) saturate(140%)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 10,
        zIndex: z.topbar,
        transition: 'left .2s ease',
      }}
    >
      {/* Mobile hamburger (hidden on desktop via media query) */}
      <button
        onClick={onToggleSidebar}
        className="mobile-hamburger-topbar"
        style={{
          display: 'none',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          background: 'none',
          border: 'none',
          color: '#6E6E73',
          cursor: 'pointer',
          borderRadius: radius.xl,
          transition: 'color .15s, background .15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#1C1C1E';
          e.currentTarget.style.background = 'rgba(0,0,0,0.04)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#6E6E73';
          e.currentTarget.style.background = 'none';
        }}
      >
        <List size={20} />
      </button>

      {/* Back button — always visible, navigates to previous page */}
      <button
        onClick={() => router.back()}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          background: 'none',
          border: '1px solid #E5E5EA',
          color: '#6E6E73',
          cursor: 'pointer',
          borderRadius: radius.xl,
          transition: 'color .15s, background .15s, border-color .15s',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#1C1C1E';
          e.currentTarget.style.background = 'rgba(0,0,0,0.04)';
          e.currentTarget.style.borderColor = 'rgba(0,0,0,0.14)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#6E6E73';
          e.currentTarget.style.background = 'none';
          e.currentTarget.style.borderColor = '#E5E5EA';
        }}
        aria-label="Go back"
      >
        <CaretLeft size={14} weight="bold" />
      </button>

      {/* Breadcrumbs */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {crumbs.map((c, i) => (
          <React.Fragment key={c.href}>
            {i > 0 && <CaretRight size={11} weight="bold" style={{ color: '#C7C7CC' }} />}
            {c.isLast ? (
              <span style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold, color: '#1C1C1E', letterSpacing: '-0.01em' }}>{c.label}</span>
            ) : (
              <Link
                href={c.href}
                style={{ fontSize: font.size.lg, color: '#6E6E73', textDecoration: 'none', transition: 'color .15s' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#1C1C1E')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#6E6E73')}
              >
                {c.label}
              </Link>
            )}
          </React.Fragment>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      {/* Search button (⌘K) */}
      <button
        onClick={onOpenCommandPalette}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 36,
          padding: '0 10px 0 12px',
          background: '#F2F2F7',
          border: '1px solid #E5E5EA',
          borderRadius: radius.xl,
          color: '#6E6E73',
          fontSize: font.size.md,
          fontWeight: font.weight.medium,
          cursor: 'pointer',
          transition: 'border-color .15s, background .15s',
          minWidth: 220,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(0,0,0,0.14)';
          e.currentTarget.style.background = '#FFFFFF';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#E5E5EA';
          e.currentTarget.style.background = '#F2F2F7';
        }}
      >
        <MagnifyingGlass size={15} style={{ color: '#AEAEB2' }} />
        <span>Search</span>
        <kbd
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            height: 20,
            padding: '0 6px',
            fontSize: font.size.xs,
            fontWeight: font.weight.semibold,
            fontFamily: font.mono,
            color: '#6E6E73',
            background: '#FFFFFF',
            border: '1px solid #E5E5EA',
            borderRadius: radius.md,
          }}
        >
          ⌘K
        </kbd>
      </button>

      {/* Sage AI */}
      <button
        onClick={onOpenSage}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          height: 36,
          padding: '0 14px',
          background: 'rgba(200,136,28,0.12)',
          border: '1px solid rgba(200,136,28,0.25)',
          borderRadius: radius.xl,
          color: '#C8881C',
          fontSize: font.size.md,
          fontWeight: font.weight.semibold,
          letterSpacing: '0.01em',
          cursor: 'pointer',
          transition: 'background .15s, border-color .15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(200,136,28,0.18)';
          e.currentTarget.style.borderColor = 'rgba(200,136,28,0.35)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(200,136,28,0.12)';
          e.currentTarget.style.borderColor = 'rgba(200,136,28,0.25)';
        }}
      >
        <Star size={15} weight="fill" />
        Sage
      </button>

      {/* Notifications */}
      <button
        onClick={() => router.push('/app/notifications')}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          background: 'none',
          border: 'none',
          color: '#6E6E73',
          cursor: 'pointer',
          borderRadius: radius.xl,
          transition: 'color .15s, background .15s',
          position: 'relative',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#1C1C1E';
          e.currentTarget.style.background = 'rgba(0,0,0,0.04)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#6E6E73';
          e.currentTarget.style.background = 'none';
        }}
      >
        <Bell size={18} />
      </button>

      {/* User avatar + menu */}
      <div style={{ position: 'relative', marginLeft: 2 }}>
        <button
          onClick={() => setShowUserMenu((v) => !v)}
          style={{
            width: 34,
            height: 34,
            borderRadius: radius.full,
            background: `linear-gradient(135deg,#F0C040,#C8881C)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: font.size.md,
            fontWeight: font.weight.bold,
            color: '#1C1C1E',
            cursor: 'pointer',
            border: 'none',
            boxShadow: showUserMenu ? `0 0 0 2px rgba(200,136,28,0.35)` : 'none',
            transition: 'box-shadow .15s',
          }}
          onMouseEnter={(e) => {
            if (!showUserMenu) e.currentTarget.style.boxShadow = `0 0 0 2px rgba(200,136,28,0.35)`;
          }}
          onMouseLeave={(e) => {
            if (!showUserMenu) e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {userInitials}
        </button>

        {showUserMenu && (
          <>
            <div onClick={() => setShowUserMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: z.dropdown - 1 }} />
            <div
              style={{
                position: 'absolute',
                top: 44,
                right: 0,
                background: '#FFFFFF',
                border: '1px solid #E5E5EA',
                borderRadius: radius['2xl'],
                minWidth: 196,
                boxShadow: '0 16px 44px rgba(0,0,0,0.10)',
                zIndex: z.dropdown,
                overflow: 'hidden',
                padding: 6,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px 10px',
                }}
              >
                <UserCircle size={28} weight="fill" style={{ color: '#AEAEB2', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: font.size.md, fontWeight: font.weight.semibold, color: '#1C1C1E', lineHeight: 1.2 }}>
                    Signed in
                  </div>
                  <div style={{ fontSize: font.size.xs, color: '#AEAEB2', lineHeight: 1.3 }}>
                    {userInitials}
                  </div>
                </div>
              </div>
              <div style={{ height: 1, background: 'rgba(0,0,0,0.08)', margin: '2px 0 6px' }} />
              <Link
                href="/app/settings"
                onClick={() => setShowUserMenu(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 10px',
                  borderRadius: radius.lg,
                  color: '#1C1C1E',
                  fontSize: font.size.md,
                  fontWeight: font.weight.medium,
                  textDecoration: 'none',
                  transition: 'background .1s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <GearSix size={16} style={{ color: '#6E6E73' }} /> Settings
              </Link>
              <button
                onClick={() => { setShowUserMenu(false); onLogout(); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '9px 10px',
                  marginTop: 2,
                  borderRadius: radius.lg,
                  background: 'none',
                  border: 'none',
                  color: '#FF3B30',
                  fontSize: font.size.md,
                  fontWeight: font.weight.medium,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background .1s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,59,48,0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <SignOut size={16} /> Sign Out
              </button>
            </div>
          </>
        )}
      </div>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 768px) {
          .mobile-hamburger-topbar { display: flex !important; }
        }
      `}</style>
    </header>
  );
}
