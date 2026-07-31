'use client';
/**
 * Legacy route — Roles & Permissions is now the "Roles & Access" tab of the
 * unified People & Access hub. Redirect old bookmarks / links there so nothing
 * 404s. See app/app/people/page.tsx.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RolesPermissionsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/app/people?tab=access'); }, [router]);
  return null;
}
