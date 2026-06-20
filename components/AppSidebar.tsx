'use client';
/**
 * AppSidebar — Premium dark sidebar with amber accents.
 * Collapsible, grouped navigation with icons, badges, and active states.
 */
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FolderSimple,
  GridFour,
  Blueprint,
  CurrencyDollar,
  FileText,
  Star,
  ChartBar,
  Brain,
  DeviceMobile,
  SquaresFour,
  CreditCard,
  ShieldCheck,
  Gear,
  CaretLeft,
  CaretRight,
  SignOut,
  MagnifyingGlass,
  Bell,
  UserCircle,
  Buildings,
  Wrench,
  ClipboardText,
  CalendarBlank,
  Truck,
  HardHat,
  Users,
} from '@phosphor-icons/react';
import { colors, font, radius, shadow, sidebar as sidebarTokens, z } from '../lib/design-tokens';
import { useWhiteLabel } from './WhiteLabelProvider';

/* ── Sidebar palette ──────────────────────────────────────────────── */
const S = {
  bg:          '#1B1815',
  bgHover:     '#26221E',
  text:        '#CFC8BF',
  textActive:  '#FFFFFF',
  textSection: '#5F574E',
  accentBar:   '#E8B420',
  activeBg:    'linear-gradient(90deg, rgba(200,136,28,.16), rgba(200,136,28,.04))',
  border:      'rgba(255,255,255,0.06)',
} as const;

/* ── Types ──────────────────────────────────────────────────────────── */
interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}
interface NavSection {
  title: string;
  items: NavItem[];
}

/* ── Navigation Config ─────────────────────────────────────────────── */
const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard',    href: '/app',              icon: GridFour },
      { label: 'Projects',     href: '/app/projects',     icon: FolderSimple },
    ],
  },
  {
    title: 'Pre-Construction',
    items: [
      { label: 'Bids & Estimates', href: '/app/bids',         icon: CurrencyDollar },
      { label: 'AI Takeoff',       href: '/app/takeoff',      icon: Blueprint },
      { label: 'Intelligence',     href: '/app/intelligence', icon: Brain },
    ],
  },
  {
    title: 'Execution',
    items: [
      { label: 'Documents',   href: '/app/documents',  icon: FileText },
      { label: 'Daily Logs',  href: '/app/daily-logs', icon: ClipboardText },
      { label: 'Schedule',    href: '/app/schedule',   icon: CalendarBlank },
      { label: 'Field App',   href: '/field',          icon: DeviceMobile },
    ],
  },
  {
    title: 'Financial',
    items: [
      { label: 'Invoicing',   href: '/app/invoicing',  icon: CreditCard },
      { label: 'Billing',     href: '/app/billing',    icon: CurrencyDollar },
      { label: 'Reports',     href: '/app/reports',    icon: ChartBar },
    ],
  },
  {
    title: 'Tools',
    items: [
      { label: 'Autopilot',   href: '/app/autopilot',   icon: Star },
      { label: 'Compliance',  href: '/app/compliance',  icon: ShieldCheck },
      { label: 'Portals',     href: '/app/portals',     icon: SquaresFour },
    ],
  },
];

const BOTTOM_ITEMS: NavItem[] = [
  { label: 'Settings', href: '/app/settings', icon: Gear },
];

/* ── Sidebar Component ─────────────────────────────────────────────── */
export default function AppSidebar({
  collapsed,
  onToggle,
  onLogout,
  userInitials,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onLogout: () => void;
  userInitials: string;
}) {
  const pathname = usePathname();
  const wl = useWhiteLabel();
  const width = collapsed ? sidebarTokens.widthCollapsed : sidebarTokens.width;

  function isActive(href: string) {
    if (href === '/app') return pathname === '/app';
    if (href === '/field') return pathname.startsWith('/field');
    return pathname.startsWith(href);
  }

  return (
    <aside
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width,
        background: S.bg,
        borderRight: `1px solid ${S.border}`,
        display: 'flex',
        flexDirection: 'column',
        zIndex: z.sidebar,
        transition: 'width .2s ease',
        overflow: 'hidden',
      }}
    >
      {/* ── Brand area ───────────────────────────────────────────── */}
      <div
        style={{
          height: sidebarTokens.headerHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? '0' : '0 16px',
          gap: 11,
          borderBottom: `1px solid ${S.border}`,
          flexShrink: 0,
        }}
      >
        <Link
          href="/app"
          aria-label="Saguaro — Dashboard"
          style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none', overflow: 'hidden' }}
        >
          {wl.whiteLabelEnabled && wl.logoUrl ? (
            <img
              src={wl.logoUrl}
              alt={wl.companyName || 'Logo'}
              style={{ height: collapsed ? 32 : 30, width: collapsed ? 32 : 'auto', maxWidth: collapsed ? 32 : 168, objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <>
              {/* Amber gradient hex icon */}
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #E8B420, #C8881C)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="16" height="18" viewBox="0 0 16 18" fill="none">
                  <path d="M8 0L15.5 4.5V13.5L8 18L0.5 13.5V4.5L8 0Z" fill="rgba(255,255,255,0.9)" />
                </svg>
              </div>
              {!collapsed && (
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, overflow: 'hidden' }}>
                  <span style={{ color: '#FFFFFF', fontWeight: 700, fontSize: 15, letterSpacing: '0.02em' }}>SAGUARO</span>
                  <span style={{ color: S.textSection, fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Control Systems</span>
                </div>
              )}
            </>
          )}
        </Link>
      </div>

      {/* ── Navigation Sections ─────────────────────────────────────── */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '10px 0' }}>
        {NAV_SECTIONS.map((section, sIdx) => (
          <div key={section.title} style={{ marginBottom: sIdx === NAV_SECTIONS.length - 1 ? 4 : 14 }}>
            {/* Section Title */}
            {!collapsed && (
              <div
                style={{
                  padding: '0 16px 6px 20px',
                  fontSize: 10,
                  fontWeight: 600,
                  color: S.textSection,
                  textTransform: 'uppercase',
                  letterSpacing: 1.2,
                  userSelect: 'none',
                }}
              >
                {section.title}
              </div>
            )}
            {collapsed && sIdx > 0 && (
              <div style={{ height: 1, background: S.border, margin: '8px 14px' }} />
            )}

            {/* Items */}
            {section.items.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    gap: 11,
                    padding: collapsed ? '9px 0' : '9px 11px',
                    margin: collapsed ? '1px 8px' : '1px 8px',
                    borderRadius: 9,
                    fontSize: 13.5,
                    fontWeight: active ? 600 : 500,
                    color: active ? S.textActive : S.text,
                    background: active ? S.activeBg : 'transparent',
                    textDecoration: 'none',
                    transition: 'background .15s ease, color .15s ease',
                    position: 'relative',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = S.bgHover;
                      e.currentTarget.style.color = S.textActive;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = S.text;
                    }
                  }}
                >
                  {/* Active indicator — amber left accent bar */}
                  {active && !collapsed && (
                    <span
                      aria-hidden
                      style={{
                        position: 'absolute',
                        left: -8,
                        top: 6,
                        bottom: 6,
                        width: 3,
                        borderRadius: '0 3px 3px 0',
                        background: S.accentBar,
                      }}
                    />
                  )}
                  <Icon
                    size={collapsed ? 20 : 18}
                    weight={active ? 'fill' : 'regular'}
                    style={{ flexShrink: 0, opacity: active ? 1 : 0.85 }}
                  />
                  {!collapsed && <span>{item.label}</span>}
                  {!collapsed && item.badge && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: 11,
                        fontWeight: 700,
                        background: active ? S.accentBar : 'rgba(255,255,255,0.08)',
                        color: active ? S.bg : S.text,
                        borderRadius: 9999,
                        padding: '1px 7px',
                        minWidth: 18,
                        textAlign: 'center',
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Bottom Section (Settings + Collapse) ────────────────────── */}
      <div style={{ borderTop: `1px solid ${S.border}`, padding: '8px 0', flexShrink: 0 }}>
        {BOTTOM_ITEMS.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: 11,
                padding: collapsed ? '9px 0' : '9px 11px',
                margin: '1px 8px',
                borderRadius: 9,
                fontSize: 13.5,
                fontWeight: active ? 600 : 500,
                color: active ? S.textActive : S.text,
                background: active ? S.activeBg : 'transparent',
                textDecoration: 'none',
                transition: 'background .15s ease, color .15s ease',
                position: 'relative',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = S.bgHover;
                  e.currentTarget.style.color = S.textActive;
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = S.text;
                }
              }}
            >
              {active && !collapsed && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: -8,
                    top: 6,
                    bottom: 6,
                    width: 3,
                    borderRadius: '0 3px 3px 0',
                    background: S.accentBar,
                  }}
                />
              )}
              <Icon size={collapsed ? 20 : 18} weight={active ? 'fill' : 'regular'} style={{ flexShrink: 0, opacity: active ? 1 : 0.85 }} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          title={collapsed ? 'Expand' : 'Collapse'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 11,
            width: 'calc(100% - 16px)',
            padding: collapsed ? '9px 0' : '9px 11px',
            margin: '1px 8px 0',
            borderRadius: 9,
            background: 'none',
            border: 'none',
            color: S.textSection,
            fontSize: 13.5,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background .15s ease, color .15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = S.bgHover;
            e.currentTarget.style.color = S.textActive;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = S.textSection;
          }}
        >
          {collapsed ? <CaretRight size={18} style={{ flexShrink: 0 }} /> : <><CaretLeft size={18} style={{ flexShrink: 0 }} /><span>Collapse</span></>}
        </button>
      </div>
    </aside>
  );
}
