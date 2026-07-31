'use client';
import { usePathname } from 'next/navigation';
import SaguaroChatWidget from './SaguaroChatWidget';

export default function MarketingChatWrapper() {
  const pathname = usePathname();
  // Don't show the marketing bot on the dashboard (/app/*) or the field PWA
  // (/field/*) — the field app has its own Sage (header button + /field/sage),
  // and the marketing FAB was floating over the field bottom nav.
  // Also keep it off auth pages — a floating mascot on a sign-in screen reads unprofessional.
  const AUTH = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify', '/welcome'];
  if (
    pathname?.startsWith('/app') ||
    pathname?.startsWith('/field') ||
    AUTH.some((p) => pathname?.startsWith(p))
  ) return null;
  return <SaguaroChatWidget variant="marketing" />;
}
