'use client';
import React from 'react';
import { colors, radius, shadow } from '../../lib/design-tokens';
import { Skeleton, SkeletonKPI, SkeletonRow } from './Skeleton';

/**
 * ModuleSkeleton — layout-true first-paint shell for module screens.
 *
 * Mirrors the standard module anatomy (hero strip -> KPI grid -> list card of
 * rows) so a first-ever visit paints the page's real shape in place of a
 * spinner or "Loading..." text gate. House pattern: rfis/page.tsx
 * SkeletonKPI/SkeletonRow. Drop it inside the page's PremiumSurface (or the
 * page's own container) where the old gate rendered.
 */
export function ModuleSkeleton({ hero = true, kpis = 4, rows = 5 }: { hero?: boolean; kpis?: number; rows?: number }) {
  return (
    <div aria-busy="true">
      {hero && (
        <div style={{ marginBottom: 26 }}>
          <Skeleton width={130} height={11} style={{ marginBottom: 14 }} />
          <Skeleton width={320} height={34} style={{ marginBottom: 12, maxWidth: '70%' }} />
          <Skeleton width={430} height={13} style={{ maxWidth: '85%' }} />
        </div>
      )}
      {kpis > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
          {Array.from({ length: kpis }).map((_, i) => (
            <SkeletonKPI key={i} />
          ))}
        </div>
      )}
      {rows > 0 && (
        <div style={{ background: colors.raised, border: `1px solid ${colors.border}`, borderRadius: radius['2xl'], boxShadow: shadow.sm, overflow: 'hidden' }}>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      )}
    </div>
  );
}
