'use client';
/**
 * AppSidebar — Procore-style persistent left sidebar.
 * Collapsible, grouped navigation with icons, badges, and active states.
 */
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FolderSimple,
  GridFour,
  Gauge,
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
  Package,
  HardHat,
  Users,
  Warning,
  Flag,
  ChartLineUp,
  Kanban,
  Notepad,
  AddressBook,
  ListChecks,
  CalendarCheck,
  ShareNetwork,
  NotePencil,
  Receipt,
  SealCheck,
  Clock,
  WifiHigh,
} from '@phosphor-icons/react';
import { colors, font, radius, shadow, sidebar as sidebarTokens, z } from '../lib/design-tokens';
import { useWhiteLabel } from './WhiteLabelProvider';
import { useEntitlements } from '../lib/hooks/useEntitlements';

/* ── Types ──────────────────────────────────────────────────────────── */
interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
  gate?: string; // gated feature flag; item hidden unless the tenant is entitled
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
      { label: 'People & Access', href: '/app/people',    icon: Users },
      { label: 'Time Clock',   href: '/app/time',         icon: Clock },
      { label: 'Fleet',        href: '/app/fleet',        icon: Truck, gate: 'fleet' },
    ],
  },
  {
    // Entire section is gated to command_center — hidden unless the tenant is entitled.
    title: 'Franchise Rollout',
    items: [
      { label: 'Command Center',    href: '/app/command-center',            icon: Gauge,        gate: 'command_center' },
      { label: 'Rollout Pipeline',  href: '/app/command-center/rollout',    icon: Kanban,       gate: 'command_center' },
      { label: 'Pre-Site Inspection', href: '/app/command-center/pre-site', icon: MagnifyingGlass, gate: 'command_center' },
      { label: 'KPI Dashboard',     href: '/app/command-center/kpis',       icon: ChartLineUp,  gate: 'command_center' },
      { label: 'Long-Lead Tracker', href: '/app/command-center/long-lead',  icon: Truck,        gate: 'command_center' },
      { label: 'Risk Register',     href: '/app/command-center/risks',      icon: Warning,      gate: 'command_center' },
      { label: 'Milestone Variance',href: '/app/command-center/milestones', icon: Flag,         gate: 'command_center' },
      { label: 'Escalations',       href: '/app/command-center/escalations',icon: Bell,         gate: 'command_center' },
      { label: 'OAC Meetings',      href: '/app/command-center/oac',        icon: Users,        gate: 'command_center' },
      { label: 'Verification Hub',  href: '/app/command-center/verify',     icon: ShieldCheck,  gate: 'command_center' },
      { label: 'Owner Updates',     href: '/app/command-center/owner-updates', icon: Notepad,   gate: 'command_center' },
      { label: 'Stakeholders',      href: '/app/command-center/directory',  icon: AddressBook,  gate: 'command_center' },
      { label: 'Phase Checklists',  href: '/app/command-center/checklists', icon: ListChecks,   gate: 'command_center' },
      { label: 'Vendor Schedule',   href: '/app/command-center/vendors',    icon: CalendarCheck,gate: 'command_center' },
      { label: 'Daily Reports',     href: '/app/command-center/daily-logs', icon: NotePencil,   gate: 'command_center' },
      { label: 'Budget & COs',      href: '/app/command-center/budget',     icon: CurrencyDollar, gate: 'command_center' },
      { label: 'Financials',        href: '/app/command-center/financials', icon: Receipt,      gate: 'command_center' },
      { label: 'QC by Trade',       href: '/app/command-center/qc',         icon: SealCheck,    gate: 'command_center' },
      { label: 'Owner Portals',     href: '/app/command-center/portals',    icon: ShareNetwork, gate: 'command_center' },
    ],
  },
  {
    title: 'Pre-Construction',
    items: [
      { label: 'Bids & Estimates', href: '/app/bids',         icon: CurrencyDollar },
      { label: 'Takeoff Studio',   href: '/app/takeoff',      icon: Blueprint },
      { label: 'Catalog',          href: '/app/catalog',      icon: Package },
      { label: 'Heatmap',          href: '/field/heatmap',    icon: WifiHigh },
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
  const { features } = useEntitlements(); // fail-closed: gated items hidden until entitled
  const width = collapsed ? sidebarTokens.widthCollapsed : sidebarTokens.width;

  function isActive(href: string) {
    if (href === '/app') return pathname === '/app';
    // Command Center index highlights only on its own page, not its sub-routes
    // (Rollout, KPIs, Long-Lead, …), which each own their nav item.
    if (href === '/app/command-center') return pathname === '/app/command-center';
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
        // machined rail: vertical gradient + a shadow cast INTO the content and a
        // lit inset hairline — the shell reads as a surface, not a flat strip
        background: `linear-gradient(180deg, ${colors.darkAlt}, #0c0d10)`,
        borderRight: '1px solid rgba(0,0,0,0.55)',
        boxShadow: '14px 0 34px rgba(0,0,0,0.35), inset -1px 0 0 rgba(255,255,255,0.05)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: z.sidebar,
        transition: 'width .2s ease',
        overflow: 'hidden',
      }}
    >
      {/* ── Logo + Brand ───────────────────────────────────────────── */}
      <div
        style={{
          height: sidebarTokens.headerHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? '0' : '0 16px',
          gap: 11,
          borderBottom: `1px solid ${colors.border}`,
          flexShrink: 0,
        }}
      >
        <Link
          href="/app"
          aria-label="Saguaro — Dashboard"
          style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none', overflow: 'hidden' }}
        >
          {/* Brand lockup. On the white-label tier (with a logo set) we show the
              TENANT's logo; otherwise the Saguaro lockup — badge when collapsed,
              full horizontal lockup when expanded. */}
          {wl.whiteLabelEnabled && wl.logoUrl ? (
            <img
              src={wl.logoUrl}
              alt={wl.companyName || 'Logo'}
              style={{ height: collapsed ? 32 : 30, width: collapsed ? 32 : 'auto', maxWidth: collapsed ? 32 : 168, objectFit: 'contain', display: 'block' }}
            />
          ) : collapsed ? (
            <img
              src="/logo-badge.png"
              alt="Saguaro Control Systems"
              style={{ height: 32, width: 32, objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <img
              src="/logo-horizontal.png"
              alt="Saguaro Control Systems"
              style={{ height: 30, width: 'auto', objectFit: 'contain', display: 'block' }}
            />
          )}
        </Link>
      </div>

      {/* ── Navigation Sections ─────────────────────────────────────── */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '10px 0' }}>
        {NAV_SECTIONS.map((section, sIdx) => {
          const visibleItems = section.items.filter((item) => !item.gate || features[item.gate] === true);
          // Hide an entire section (title + divider) when the tenant sees none of its items.
          if (visibleItems.length === 0) return null;
          return (
          <div key={section.title} style={{ marginBottom: sIdx === NAV_SECTIONS.length - 1 ? 4 : 14 }}>
            {/* Section Title */}
            {!collapsed && (
              <div
                style={{
                  padding: '0 16px 6px 20px',
                  fontSize: '10px',
                  fontWeight: font.weight.bold,
                  color: colors.textFaint,
                  textTransform: 'uppercase',
                  letterSpacing: 1.4,
                  userSelect: 'none',
                }}
              >
                {section.title}
              </div>
            )}
            {collapsed && sIdx > 0 && (
              <div style={{ height: 1, background: colors.borderDim, margin: '8px 14px' }} />
            )}

            {/* Items */}
            {visibleItems.map((item) => {
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
                    height: sidebarTokens.itemHeight,
                    padding: collapsed ? '0' : '0 12px 0 16px',
                    margin: '2px 8px',
                    borderRadius: radius.lg,
                    fontSize: font.size.md,
                    fontWeight: active ? font.weight.semibold : font.weight.medium,
                    color: active ? colors.gold : colors.textMuted,
                    background: active
                      ? 'linear-gradient(180deg, var(--brand-primary-18), var(--brand-primary-12))'
                      : 'transparent',
                    boxShadow: active ? 'inset 0 0 0 1px var(--brand-primary-25)' : 'none',
                    textDecoration: 'none',
                    transition: 'background .15s ease, color .15s ease',
                    position: 'relative',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                      e.currentTarget.style.color = colors.text;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = colors.textMuted;
                    }
                  }}
                >
                  {/* Active indicator — soft gold left rule */}
                  {active && !collapsed && (
                    <span
                      aria-hidden
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 8,
                        bottom: 8,
                        width: 3,
                        borderRadius: '0 3px 3px 0',
                        background: colors.gold,
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
                        fontSize: font.size.xs,
                        fontWeight: font.weight.bold,
                        background: active ? colors.gold : colors.raisedAlt,
                        color: active ? colors.dark : colors.textMuted,
                        borderRadius: radius.full,
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
          );
        })}
      </nav>

      {/* ── Bottom Section (Settings + Collapse) ────────────────────── */}
      <div style={{ borderTop: `1px solid ${colors.border}`, padding: '8px 0', flexShrink: 0 }}>
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
                height: sidebarTokens.itemHeight,
                padding: collapsed ? '0' : '0 12px 0 16px',
                margin: '2px 8px',
                borderRadius: radius.lg,
                fontSize: font.size.md,
                fontWeight: active ? font.weight.semibold : font.weight.medium,
                color: active ? colors.gold : colors.textMuted,
                background: active ? colors.goldDim : 'transparent',
                textDecoration: 'none',
                transition: 'background .15s ease, color .15s ease',
                position: 'relative',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.color = colors.text;
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = colors.textMuted;
                }
              }}
            >
              {active && !collapsed && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 8,
                    bottom: 8,
                    width: 3,
                    borderRadius: '0 3px 3px 0',
                    background: colors.gold,
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
            height: sidebarTokens.itemHeight,
            padding: collapsed ? '0' : '0 12px 0 16px',
            margin: '2px 8px 0',
            borderRadius: radius.lg,
            background: 'none',
            border: 'none',
            color: colors.textDim,
            fontSize: font.size.md,
            fontWeight: font.weight.medium,
            cursor: 'pointer',
            transition: 'background .15s ease, color .15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            e.currentTarget.style.color = colors.text;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = colors.textDim;
          }}
        >
          {collapsed ? <CaretRight size={18} style={{ flexShrink: 0 }} /> : <><CaretLeft size={18} style={{ flexShrink: 0 }} /><span>Collapse</span></>}
        </button>
      </div>
    </aside>
  );
}
