/**
 * Saguaro premium UI kit — the shared design system that codifies the
 * "AI Blueprint Takeoff" aesthetic (aurora backdrop, ambient gold glow,
 * premium cards, cinematic motion) for every module to adopt.
 *
 * All components are purely presentational, theme-token driven (white-label
 * safe via var(--brand-primary)), responsive, and light/dark aware.
 *
 *   import { ModuleHero, StatCard, StatGrid, PremiumEmpty, SectionCard, GradientButton } from '@/components/ui';
 */

export { ModuleHero } from './ModuleHero';
export type { ModuleHeroProps } from './ModuleHero';

export { StatCard, StatGrid } from './StatCard';
export type { StatCardProps, StatGridProps } from './StatCard';

export { PremiumEmpty } from './PremiumEmpty';
export type { PremiumEmptyProps } from './PremiumEmpty';

export { SectionCard } from './SectionCard';
export type { SectionCardProps } from './SectionCard';

export { GradientButton } from './GradientButton';
export type { GradientButtonProps } from './GradientButton';

// Shared FX primitives — for bespoke compositions that want the same backdrop.
export { Aurora, UiFx, gold, GOLD, GOLD_HI, GOLD_TEXT_GRADIENT, UI_FX_CSS } from './fx';
