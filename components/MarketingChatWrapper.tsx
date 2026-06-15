'use client';
import { usePathname } from 'next/navigation';
import SaguaroChatWidget from './SaguaroChatWidget';

export default function MarketingChatWrapper() {
  const pathname = usePathname();
  // Don't show the marketing bot on the dashboard (/app/*) or the field PWA
  // (/field/*) — the field app has its own Sage (header button + /field/sage),
  // and the marketing FAB was floating over the field bottom nav.
  if (pathname?.startsWith('/app') || pathname?.startsWith('/field')) return null;
  return <SaguaroChatWidget variant="marketing" />;
}
