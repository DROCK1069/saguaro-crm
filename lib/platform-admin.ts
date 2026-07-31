/**
 * Platform (super-admin) gate. The platform owner(s) — the people who manage
 * Saguaro itself, not a tenant — are listed in env PLATFORM_ADMIN_EMAILS
 * (comma-separated, case-insensitive). Used to gate the Platform Integrations
 * admin (OAuth app credentials shared by all tenants).
 */
export function isPlatformAdmin(email?: string | null): boolean {
  if (!email) return false;
  const list = (process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}
