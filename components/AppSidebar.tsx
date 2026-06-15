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
        background: colors.darkAlt,
        borderRight: `1px solid ${colors.border}`,
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
          {/* Brand mark — existing logo image in a clean gold-tinted square */}
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 34,
              width: 34,
              flexShrink: 0,
              borderRadius: radius.xl,
              background: colors.goldDim,
              border: `1px solid ${colors.goldBorder}`,
            }}
          >
            <img
              src="/logo-icon.jpg"
              alt="Saguaro"
              style={{
                height: 22,
                width: 22,
                objectFit: 'contain',
                borderRadius: radius.sm,
                display: 'block',
              }}
            />
          </span>
          {!collapsed && (
            <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
              <span style={{
                fontWeight: font.weight.black,
                fontSize: font.size.xl,
                letterSpacing: 1.4,
                background: `linear-gradient(90deg,${colors.gold},${colors.goldLight})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                SAGUARO
              </span>
              <span style={{
                fontSize: '10px',
                color: colors.textDim,
                fontWeight: font.weight.semibold,
                letterSpacing: 1.6,
                textTransform: 'uppercase',
                marginTop: 1,
              }}>
                Control Systems
              </span>
            </span>
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
                    overflow: 'hidden',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = 'rgba(0,0,0,.04)';
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
        ))}
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
                  e.currentTarget.style.background = 'rgba(0,0,0,.04)';
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
            e.currentTarget.style.background = 'rgba(0,0,0,.04)';
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
