'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getAuthHeaders, getSupabaseBrowser } from '@/lib/supabase-browser';

/* ── palette ── */
const GOLD = '#F59E0B';
const BG = '#0a0a0a';
const RAISED = '#141416';
const BORDER = 'rgba(255,255,255,0.12)';
const TEXT = '#FFFFFF';
const DIM = '#CBD5E1';
const GREEN = '#22C55E';
const RED = '#EF4444';
const AMBER = '#F59E0B';
const BLUE = '#F59E0B';
const PURPLE = '#8B5CF6';

/* ── types ── */
type PermLevel = 'None' | 'View' | 'Edit' | 'Full';
type PermissionMap = Record<string, PermLevel>;
type Tab = 'roles' | 'matrix' | 'users' | 'compare' | 'audit';

interface Role {
  id: string;
  name: string;
  description: string;
  color: string;
  isBuiltIn: boolean;
  permissions: PermissionMap;
  createdAt: string;
  updatedAt: string;
}

interface UserAssignment {
  id: string;
  userId: string;
  userName: string;
  email: string;
  roleId: string;
  projectId: string | null;
  projectName: string | null;
  assignedAt: string;
  assignedBy: string;
}

interface AuditEntry {
  id: string;
  action: string;
  roleName: string;
  changedBy: string;
  changedAt: string;
  detail: string;
}

const PERM_LEVELS: PermLevel[] = ['None', 'View', 'Edit', 'Full'];

const CATEGORIES = [
  'Projects', 'Budget', 'Schedule', 'Safety', 'Documents',
  'RFIs', 'Submittals', 'Change Orders', 'Pay Apps', 'Reports', 'Admin',
];

const ROLE_PRESETS: { name: string; desc: string; color: string; perms: PermissionMap }[] = [
  { name: 'Admin', desc: 'Full system access across all modules.', color: GOLD,
    perms: Object.fromEntries(CATEGORIES.map(c => [c, 'Full' as PermLevel])) },
  { name: 'Project Manager', desc: 'Manage projects end-to-end, approve COs and pay apps.', color: BLUE,
    perms: Object.fromEntries(CATEGORIES.map(c => [c, c === 'Admin' ? 'View' as PermLevel : 'Full' as PermLevel])) },
  { name: 'Superintendent', desc: 'Field operations — schedule, safety, daily reporting.', color: GREEN,
    perms: Object.fromEntries(CATEGORIES.map(c => {
      if (['Schedule','Safety','Documents','RFIs','Submittals'].includes(c)) return [c, 'Edit' as PermLevel];
      if (['Projects','Budget','Change Orders','Pay Apps','Reports'].includes(c)) return [c, 'View' as PermLevel];
      return [c, 'None' as PermLevel];
    })) },
  { name: 'Foreman', desc: 'Daily field reporting and crew management.', color: '#F97316',
    perms: Object.fromEntries(CATEGORIES.map(c => {
      if (['Safety','Schedule'].includes(c)) return [c, 'Edit' as PermLevel];
      if (['Projects','Documents','RFIs','Submittals','Reports'].includes(c)) return [c, 'View' as PermLevel];
      return [c, 'None' as PermLevel];
    })) },
  { name: 'Subcontractor', desc: 'Limited access for subcontractor partners.', color: PURPLE,
    perms: Object.fromEntries(CATEGORIES.map(c => {
      if (['Submittals','RFIs'].includes(c)) return [c, 'Edit' as PermLevel];
      if (['Projects','Documents','Schedule','Safety','Pay Apps'].includes(c)) return [c, 'View' as PermLevel];
      return [c, 'None' as PermLevel];
    })) },
  { name: 'Read-Only', desc: 'View-only access. Cannot modify any data.', color: DIM,
    perms: Object.fromEntries(CATEGORIES.map(c => [c, 'View' as PermLevel])) },
];

const ROLE_COLORS = [GOLD, BLUE, GREEN, RED, AMBER, PURPLE, '#EC4899', '#14B8A6', '#F97316'];

/* ── view types for the two lightweight lookup lists ── */
interface TenantUser { id: string; name: string; email: string }
interface TenantProject { id: string; name: string }

/* pending sent invite (team_invites row, status='pending') */
interface PendingInvite {
  id: string;
  email: string;
  role: string | null;
  created_at: string;
  invited_by: string | null;
}

/* Invites have no expires_at column — they expire 7 days after created_at. */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/* ── style helpers ── */
const btn = (bg: string, color = TEXT): React.CSSProperties => ({
  background: bg, color, border: 'none', borderRadius: 6, padding: '8px 18px',
  cursor: 'pointer', fontWeight: 600, fontSize: 13, transition: 'opacity .15s',
});
const inputStyle = (): React.CSSProperties => ({
  background: BG, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 6,
  padding: '8px 12px', fontSize: 13, width: '100%', outline: 'none',
});
const labelStyle = (): React.CSSProperties => ({
  color: DIM, fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block',
});
const card = (): React.CSSProperties => ({
  background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 10,
  padding: 20, marginBottom: 14,
});

/* ── helpers ── */
function emptyPermissions(): PermissionMap {
  return Object.fromEntries(CATEGORIES.map(c => [c, 'None' as PermLevel]));
}

function permLevelColor(level: PermLevel): string {
  switch (level) {
    case 'Full': return GREEN;
    case 'Edit': return BLUE;
    case 'View': return AMBER;
    default: return '#8094B0';
  }
}

function permLevelLabel(level: PermLevel): string {
  if (level === 'Full') return 'Full (CRUD + Approve)';
  return level;
}

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return iso; }
}

function fmtDateTime(iso: string): string {
  try { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  catch { return iso; }
}

/** Compact "time since" for a sent invite (e.g. "just now", "3h ago", "2d ago"). */
function relTimeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const diff = Date.now() - then;
  if (diff < 60_000) return 'just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/** Countdown label for an invite that expires 7 days after created_at. */
function inviteExpiry(createdIso: string): { label: string; expired: boolean } {
  const created = new Date(createdIso).getTime();
  if (isNaN(created)) return { label: '—', expired: false };
  const remaining = created + INVITE_TTL_MS - Date.now();
  if (remaining <= 0) return { label: 'Expired', expired: true };
  const totalHrs = Math.floor(remaining / (60 * 60 * 1000));
  const days = Math.floor(totalHrs / 24);
  const hrs = totalHrs % 24;
  if (days > 0) return { label: `in ${days}d ${hrs}h`, expired: false };
  if (hrs > 0) return { label: `in ${hrs}h`, expired: false };
  const mins = Math.max(1, Math.floor(remaining / (60 * 1000)));
  return { label: `in ${mins}m`, expired: false };
}

/* ── DB row → view mappers (REAL data only — no mocks) ── */
/* eslint-disable @typescript-eslint/no-explicit-any */
function mapRole(row: any): Role {
  const raw = row?.permissions && typeof row.permissions === 'object' ? row.permissions : {};
  const permissions = { ...emptyPermissions(), ...raw } as PermissionMap;
  return {
    id: String(row.id),
    name: row.name ?? 'Untitled Role',
    description: row.description ?? '',
    color: row.color || GOLD,
    isBuiltIn: !!row.is_builtin,
    permissions,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
  };
}

function mapAssignment(a: any, us: TenantUser[], ps: TenantProject[]): UserAssignment {
  const u = us.find((x) => x.id === a.userId);
  const p = a.projectId ? ps.find((x) => x.id === a.projectId) : null;
  return {
    id: String(a.id),
    userId: a.userId,
    userName: a.userName || u?.name || 'Unknown',
    email: a.email || u?.email || '',
    roleId: a.roleId,
    projectId: a.projectId ?? null,
    projectName: a.projectName || p?.name || null,
    assignedAt: a.assignedAt ?? new Date().toISOString(),
    assignedBy: a.assignedBy || 'System',
  };
}

/** Seed the six built-in role presets as REAL rows when a tenant has none yet. */
async function seedPresets(headers: Record<string, string>): Promise<void> {
  for (const p of ROLE_PRESETS) {
    const res = await fetch('/api/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ name: p.name, description: p.desc, permissions: p.perms, color: p.color, is_builtin: true }),
    });
    if (!res.ok) throw new Error('Could not seed the built-in roles.');
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ── overlay / modal wrapper ── */
function Modal({ open, onClose, title, width, children }: {
  open: boolean; onClose: () => void; title: string; width?: number;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: RAISED, border: `1px solid ${BORDER}`, borderRadius: 12,
        width: width ?? 520, maxHeight: '85vh', overflowY: 'auto', padding: 28, zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ color: GOLD, margin: 0, fontSize: 18 }}>{title}</h3>
          <button onClick={onClose} style={{ ...btn('transparent', DIM), fontSize: 20, padding: 4 }}>X</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── loading spinner ── */
function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div style={{ width: 36, height: 36, border: `3px solid ${BORDER}`, borderTopColor: GOLD,
        borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ======================================================================== */
export function AccessManager() {
  const [tab, setTab] = useState<Tab>('roles');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<UserAssignment[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);

  /* real tenant lookups (replace the deleted mock arrays) */
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [projects, setProjects] = useState<TenantProject[]>([]);

  /* transient success / error toast for actions (load errors use `error`) */
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);

  /* create / edit role modal */
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editRoleId, setEditRoleId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formColor, setFormColor] = useState(ROLE_COLORS[0]);
  const [formPerms, setFormPerms] = useState<PermissionMap>(emptyPermissions());

  /* compare */
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');

  /* user filters */
  const [userSearch, setUserSearch] = useState('');
  const [filterRoleId, setFilterRoleId] = useState('');

  /* assign modal */
  const [showAssign, setShowAssign] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignRoleId, setAssignRoleId] = useState('');
  const [assignProjectId, setAssignProjectId] = useState('');

  /* invite modal */
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('');

  /* ── pending sent invites (tenant-scoped; used by the Users tab panel) ── */
  const loadInvites = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/team/invite', { headers });
      if (!res.ok) return;
      const raw = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const arr: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.invites) ? raw.invites : [];
      setPendingInvites(arr as PendingInvite[]);
    } catch { /* non-fatal — leave the list as-is */ }
  }, []);

  /* ── load data (100% real, tenant-scoped; no mock fallbacks) ── */
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();

      /* Real tenant users (profiles) + real projects, in parallel. */
      const sb = getSupabaseBrowser();
      const [usersRes, projRes] = await Promise.all([
        fetch('/api/team/users', { headers }),
        sb.from('projects').select('id, name').order('name'),
      ]);

      const loadedUsers: TenantUser[] = usersRes.ok
        ? (((await usersRes.json())?.users ?? []) as TenantUser[])
        : [];
      setUsers(loadedUsers);

      const loadedProjects: TenantProject[] = (projRes.data ?? []).map((p) => ({ id: p.id as string, name: (p.name as string) ?? 'Project' }));
      setProjects(loadedProjects);

      /* Roles — seed the built-in presets as REAL rows if this tenant has none. */
      const rolesRes = await fetch('/api/roles', { headers });
      if (!rolesRes.ok) throw new Error('Unable to load roles. Please sign in and try again.');
      const rolesJson = await rolesRes.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let rolesRaw: any[] = Array.isArray(rolesJson) ? rolesJson : Array.isArray(rolesJson?.roles) ? rolesJson.roles : [];
      if (rolesRaw.length === 0) {
        await seedPresets(headers);
        const reRes = await fetch('/api/roles', { headers });
        if (reRes.ok) {
          const reJson = await reRes.json();
          rolesRaw = Array.isArray(reJson) ? reJson : Array.isArray(reJson?.roles) ? reJson.roles : [];
        }
      }
      const loadedRoles = rolesRaw.map(mapRole);
      setRoles(loadedRoles);
      if (loadedRoles.length > 0) {
        setSelectedRoleId((cur) => (cur && loadedRoles.some((r) => r.id === cur) ? cur : loadedRoles[0].id));
        setCompareA((cur) => cur || loadedRoles[0].id);
        setCompareB((cur) => cur || (loadedRoles[1]?.id ?? ''));
      } else {
        setSelectedRoleId(null);
      }

      /* Assignments — denormalized against the REAL users/roles/projects. */
      const assignRes = await fetch('/api/roles/assignments', { headers });
      let loadedAssign: UserAssignment[] = [];
      if (assignRes.ok) {
        const raw = await assignRes.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const arr: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.assignments) ? raw.assignments : [];
        loadedAssign = arr.map((a) => mapAssignment(a, loadedUsers, loadedProjects));
      }
      setAssignments(loadedAssign);

      /* Audit — real rows from audit_logs; may legitimately be empty. */
      const auditRes = await fetch('/api/roles/audit', { headers });
      let loadedAudit: AuditEntry[] = [];
      if (auditRes.ok) {
        const raw = await auditRes.json();
        const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.audit) ? raw.audit : [];
        loadedAudit = arr as AuditEntry[];
      }
      setAudit(loadedAudit);

      /* Pending sent invites — tenant-scoped; may legitimately be empty. */
      await loadInvites();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roles data.');
    } finally {
      setLoading(false);
    }
  }, [loadInvites]);

  useEffect(() => { loadData(); }, [loadData]);

  const selectedRole = useMemo(() => roles.find(r => r.id === selectedRoleId) ?? null, [roles, selectedRoleId]);
  const roleA = useMemo(() => roles.find(r => r.id === compareA) ?? null, [roles, compareA]);
  const roleB = useMemo(() => roles.find(r => r.id === compareB) ?? null, [roles, compareB]);

  /* ── actions ── */
  const notify = (msg: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ msg, kind });
    window.setTimeout(() => setToast(null), 3200);
  };

  const openCreateRole = () => {
    setEditRoleId(null);
    setFormName('');
    setFormDesc('');
    setFormColor(ROLE_COLORS[0]);
    setFormPerms(emptyPermissions());
    setShowRoleModal(true);
  };

  const openEditRole = (role: Role) => {
    if (role.isBuiltIn) return;
    setEditRoleId(role.id);
    setFormName(role.name);
    setFormDesc(role.description);
    setFormColor(role.color);
    setFormPerms({ ...role.permissions });
    setShowRoleModal(true);
  };

  const saveRole = async () => {
    if (!formName.trim()) return;
    const headers = await getAuthHeaders();
    try {
      const body = JSON.stringify({
        name: formName.trim(), description: formDesc.trim(), color: formColor,
        permissions: formPerms, is_builtin: false,
      });
      const res = editRoleId
        ? await fetch(`/api/roles/${editRoleId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers }, body })
        : await fetch('/api/roles', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });
      if (!res.ok) throw new Error('save failed');
      setShowRoleModal(false);
      notify(editRoleId ? 'Role updated.' : 'Role created.');
      await loadData();
    } catch {
      notify('Could not save the role. Please try again.', 'err');
    }
  };

  const duplicateRole = async (source: Role) => {
    const headers = await getAuthHeaders();
    try {
      const res = await fetch('/api/roles', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          name: `${source.name} (Copy)`, description: source.description, color: source.color,
          permissions: source.permissions, is_builtin: false,
        }),
      });
      if (!res.ok) throw new Error('duplicate failed');
      notify('Role duplicated.');
      await loadData();
    } catch {
      notify('Could not duplicate the role.', 'err');
    }
  };

  const deleteRole = async (id: string) => {
    const r = roles.find(x => x.id === id);
    if (!r || r.isBuiltIn) return;
    if (!confirm(`Delete role "${r.name}"? Users will be unassigned.`)) return;
    const headers = await getAuthHeaders();
    try {
      const res = await fetch(`/api/roles/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error('delete failed');
      if (selectedRoleId === id) setSelectedRoleId(null);
      notify('Role deleted.');
      await loadData();
    } catch {
      notify('Could not delete the role.', 'err');
    }
  };

  const togglePerm = async (roleId: string, category: string, level: PermLevel) => {
    const r = roles.find(x => x.id === roleId);
    if (!r || r.isBuiltIn) return;
    const newPerms: PermissionMap = { ...r.permissions, [category]: level };
    /* optimistic — reverted from server truth on failure */
    setRoles(prev => prev.map(x => x.id === roleId ? { ...x, permissions: newPerms, updatedAt: new Date().toISOString() } : x));
    const headers = await getAuthHeaders();
    try {
      const res = await fetch(`/api/roles/${roleId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ permissions: newPerms }),
      });
      if (!res.ok) throw new Error('permission save failed');
    } catch {
      notify(`Could not save "${category}" (${permLevelLabel(level)}).`, 'err');
      await loadData();
    }
  };

  const assignRole = async () => {
    if (!assignUserId || !assignRoleId) return;
    const headers = await getAuthHeaders();
    try {
      const res = await fetch('/api/roles', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ _type: 'assignment', user_id: assignUserId, role_id: assignRoleId, project_id: assignProjectId || null }),
      });
      if (!res.ok) throw new Error('assign failed');
      setShowAssign(false);
      setAssignUserId('');
      setAssignRoleId('');
      setAssignProjectId('');
      notify('Role assigned.');
      await loadData();
    } catch {
      notify('Could not assign the role.', 'err');
    }
  };

  const removeAssignment = async (id: string) => {
    const headers = await getAuthHeaders();
    try {
      const res = await fetch(`/api/roles/assignments/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error('remove failed');
      notify('Assignment removed.');
      await loadData();
    } catch {
      notify('Could not remove the assignment.', 'err');
    }
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    const headers = await getAuthHeaders();
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ email: inviteEmail.trim(), name: inviteName.trim() || inviteEmail.trim(), role: inviteRole || 'member' }),
      });
      if (!res.ok) throw new Error('invite failed');
      setShowInvite(false);
      setInviteEmail('');
      setInviteName('');
      setInviteRole('');
      notify('Invite sent.');
      await loadData();
    } catch {
      notify('Could not send the invite.', 'err');
    }
  };

  const cancelInvite = async (id: string) => {
    const headers = await getAuthHeaders();
    try {
      const res = await fetch(`/api/team/invite/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error('cancel failed');
      notify('Invite cancelled.');
      await loadInvites();
    } catch {
      notify('Could not cancel the invite.', 'err');
    }
  };

  const resendInvite = async (id: string) => {
    const headers = await getAuthHeaders();
    try {
      const res = await fetch(`/api/team/invite/${id}`, { method: 'POST', headers });
      if (!res.ok) throw new Error('resend failed');
      notify('Invite resent — the 7-day clock has been reset.');
      await loadInvites();
    } catch {
      notify('Could not resend the invite.', 'err');
    }
  };

  const resetUserPassword = async (userId: string, userName: string) => {
    const headers = await getAuthHeaders();
    try {
      const res = await fetch(`/api/team/users/${userId}/reset-password`, { method: 'POST', headers });
      if (!res.ok) throw new Error('reset failed');
      notify(`Password reset email sent to ${userName}.`);
    } catch {
      notify('Could not send the reset email.', 'err');
    }
  };

  /* ── filtered assignments ── */
  const filteredAssignments = useMemo(() => {
    let list = assignments;
    if (userSearch) {
      const q = userSearch.toLowerCase();
      list = list.filter(a => a.userName.toLowerCase().includes(q) || a.email.toLowerCase().includes(q));
    }
    if (filterRoleId) list = list.filter(a => a.roleId === filterRoleId);
    return list;
  }, [assignments, userSearch, filterRoleId]);

  /* ── tab bar ── */
  const tabs: { key: Tab; label: string }[] = [
    { key: 'roles', label: 'Roles' },
    { key: 'matrix', label: 'Permission Matrix' },
    { key: 'users', label: 'User Assignments' },
    { key: 'compare', label: 'Compare Roles' },
    { key: 'audit', label: 'Audit Log' },
  ];

  if (loading) return (
    <div style={{ minHeight: '100vh', background: BG, padding: 32 }}>
      <h1 style={{ color: GOLD, fontSize: 26, margin: 0, marginBottom: 8 }}>Roles & Permissions</h1>
      <Spinner />
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', background: BG, padding: 32 }}>
      <h1 style={{ color: GOLD, fontSize: 26, margin: 0, marginBottom: 8 }}>Roles & Permissions</h1>
      <div style={{ ...card(), borderColor: RED }}>
        <p style={{ color: RED, margin: 0, marginBottom: 12 }}>Error: {error}</p>
        <button onClick={loadData} style={btn(GOLD, BG)}>Retry</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: BG, padding: 32 }}>
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ color: GOLD, fontSize: 26, margin: 0 }}>Roles & Permissions</h1>
          <p style={{ color: DIM, fontSize: 13, margin: '4px 0 0' }}>
            Manage access levels across {CATEGORIES.length} categories -- {roles.length} roles configured
          </p>
        </div>
        <button onClick={openCreateRole} style={btn(GOLD, BG)}>+ New Role</button>
      </div>

      {/* tab bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `2px solid ${BORDER}`, marginBottom: 22 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: 'transparent', border: 'none', color: tab === t.key ? GOLD : DIM,
            fontWeight: tab === t.key ? 700 : 500, fontSize: 14, padding: '10px 20px',
            borderBottom: tab === t.key ? `2px solid ${GOLD}` : '2px solid transparent',
            cursor: 'pointer', marginBottom: -2, transition: 'color .15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── TAB: ROLES ── */}
      {tab === 'roles' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>
          {/* left: role list */}
          <div>
            {roles.map(r => {
              const count = assignments.filter(a => a.roleId === r.id).length;
              const isSelected = r.id === selectedRoleId;
              return (
                <div key={r.id} onClick={() => setSelectedRoleId(r.id)} style={{
                  ...card(), cursor: 'pointer', marginBottom: 8,
                  borderColor: isSelected ? r.color : BORDER,
                  background: isSelected ? `${r.color}11` : RAISED,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: r.color }} />
                      <span style={{ color: TEXT, fontWeight: 600, fontSize: 14 }}>{r.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {r.isBuiltIn && (
                        <span style={{ background: `${BLUE}22`, color: BLUE, fontSize: 10, fontWeight: 700,
                          padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' }}>Built-in</span>
                      )}
                      {!r.isBuiltIn && (
                        <span style={{ background: `${PURPLE}22`, color: PURPLE, fontSize: 10, fontWeight: 700,
                          padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' }}>Custom</span>
                      )}
                      <span style={{ color: DIM, fontSize: 11 }}>{count} user{count !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <p style={{ color: DIM, fontSize: 12, margin: '6px 0 0', lineHeight: 1.4 }}>{r.description}</p>
                </div>
              );
            })}
          </div>

          {/* right: selected role detail */}
          <div>
            {selectedRole ? (
              <div style={card()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: selectedRole.color }} />
                      <h2 style={{ color: TEXT, margin: 0, fontSize: 20 }}>{selectedRole.name}</h2>
                      {selectedRole.isBuiltIn ? (
                        <span style={{ background: `${BLUE}22`, color: BLUE, fontSize: 10, fontWeight: 700,
                          padding: '2px 8px', borderRadius: 4 }}>BUILT-IN</span>
                      ) : (
                        <span style={{ background: `${PURPLE}22`, color: PURPLE, fontSize: 10, fontWeight: 700,
                          padding: '2px 8px', borderRadius: 4 }}>CUSTOM</span>
                      )}
                    </div>
                    <p style={{ color: DIM, fontSize: 13, margin: 0 }}>{selectedRole.description}</p>
                    <p style={{ color: DIM, fontSize: 11, margin: '6px 0 0' }}>
                      Created {fmtDate(selectedRole.createdAt)} -- Last updated {fmtDate(selectedRole.updatedAt)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {!selectedRole.isBuiltIn && (
                      <button onClick={() => openEditRole(selectedRole)} style={btn(BLUE)}>Edit</button>
                    )}
                    <button onClick={() => duplicateRole(selectedRole)} style={btn(RAISED, DIM)}>Duplicate</button>
                    {!selectedRole.isBuiltIn && (
                      <button onClick={() => deleteRole(selectedRole.id)} style={btn(RAISED, RED)}>Delete</button>
                    )}
                  </div>
                </div>

                {/* permission grid for selected role */}
                <h4 style={{ color: GOLD, fontSize: 14, marginBottom: 10 }}>Permissions</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '160px repeat(4, 1fr)', gap: 0, fontSize: 12 }}>
                  {/* header */}
                  <div style={{ padding: '8px 10px', fontWeight: 700, color: DIM, borderBottom: `1px solid ${BORDER}` }}>Category</div>
                  {PERM_LEVELS.map(l => (
                    <div key={l} style={{ padding: '8px 10px', fontWeight: 700, color: DIM, textAlign: 'center',
                      borderBottom: `1px solid ${BORDER}` }}>{l === 'Full' ? 'Full (CRUD+)' : l}</div>
                  ))}
                  {/* rows */}
                  {CATEGORIES.map(cat => (
                    <React.Fragment key={cat}>
                      <div style={{ padding: '8px 10px', color: TEXT, borderBottom: `1px solid ${BORDER}15` }}>{cat}</div>
                      {PERM_LEVELS.map(level => {
                        const isActive = selectedRole.permissions[cat] === level;
                        const canEdit = !selectedRole.isBuiltIn;
                        return (
                          <div key={level} style={{ padding: '6px 10px', textAlign: 'center',
                            borderBottom: `1px solid ${BORDER}15` }}>
                            <div onClick={() => canEdit && togglePerm(selectedRole.id, cat, level)} style={{
                              width: 22, height: 22, borderRadius: '50%', margin: '0 auto',
                              border: `2px solid ${isActive ? permLevelColor(level) : BORDER}`,
                              background: isActive ? permLevelColor(level) : 'transparent',
                              cursor: canEdit ? 'pointer' : 'default', transition: 'all .15s',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {isActive && <span style={{ color: level === 'None' ? DIM : '#fff', fontSize: 11, fontWeight: 700 }}>
                                {level === 'None' ? '-' : '\u2713'}
                              </span>}
                            </div>
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>

                {/* assigned users for this role */}
                <h4 style={{ color: GOLD, fontSize: 14, marginTop: 22, marginBottom: 10 }}>Assigned Users</h4>
                {assignments.filter(a => a.roleId === selectedRole.id).length === 0 ? (
                  <p style={{ color: DIM, fontSize: 12 }}>No users assigned to this role.</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {assignments.filter(a => a.roleId === selectedRole.id).map(a => (
                      <div key={a.id} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8,
                        padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <span style={{ color: TEXT, fontWeight: 600 }}>{a.userName}</span>
                        {a.projectName && <span style={{ color: AMBER, fontSize: 10 }}>({a.projectName})</span>}
                        <button onClick={() => removeAssignment(a.id)} style={{
                          background: 'transparent', border: 'none', color: RED, cursor: 'pointer',
                          fontSize: 14, padding: 0, lineHeight: 1,
                        }}>x</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={card()}>
                <p style={{ color: DIM, textAlign: 'center' }}>Select a role to view details.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: PERMISSION MATRIX ── */}
      {tab === 'matrix' && (
        <div style={{ ...card(), overflowX: 'auto' }}>
          <h3 style={{ color: TEXT, margin: '0 0 16px', fontSize: 16 }}>Full Permission Matrix</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: DIM, borderBottom: `2px solid ${BORDER}`,
                  position: 'sticky', left: 0, background: RAISED, zIndex: 2 }}>Category</th>
                {roles.map(r => (
                  <th key={r.id} style={{ padding: '10px 8px', textAlign: 'center', borderBottom: `2px solid ${BORDER}`,
                    minWidth: 100 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: r.color }} />
                      <span style={{ color: TEXT, fontWeight: 600, fontSize: 11 }}>{r.name}</span>
                      {r.isBuiltIn ? (
                        <span style={{ color: BLUE, fontSize: 9, fontWeight: 700 }}>BUILT-IN</span>
                      ) : (
                        <span style={{ color: PURPLE, fontSize: 9, fontWeight: 700 }}>CUSTOM</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map(cat => (
                <tr key={cat}>
                  <td style={{ padding: '8px 12px', color: TEXT, fontWeight: 500,
                    borderBottom: `1px solid ${BORDER}20`, position: 'sticky', left: 0,
                    background: RAISED, zIndex: 1 }}>{cat}</td>
                  {roles.map(r => {
                    const level = r.permissions[cat] ?? 'None';
                    return (
                      <td key={r.id} style={{ padding: '6px 8px', textAlign: 'center',
                        borderBottom: `1px solid ${BORDER}20` }}>
                        <span style={{
                          display: 'inline-block', padding: '3px 10px', borderRadius: 4, fontSize: 11,
                          fontWeight: 600, color: level === 'None' ? DIM : '#fff',
                          background: level === 'None' ? `${DIM}15` : `${permLevelColor(level)}22`,
                          border: `1px solid ${level === 'None' ? 'transparent' : permLevelColor(level)}`,
                        }}>{level === 'Full' ? 'Full' : level}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 16, display: 'flex', gap: 16, fontSize: 11, color: DIM }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: GREEN, marginRight: 4 }} />Full = Create, Read, Update, Delete + Approve</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: BLUE, marginRight: 4 }} />Edit = Create, Read, Update</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: AMBER, marginRight: 4 }} />View = Read Only</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: DIM, marginRight: 4 }} />None = No Access</span>
          </div>
        </div>
      )}

      {/* ── TAB: USER ASSIGNMENTS ── */}
      {tab === 'users' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
            <input placeholder="Search users..." value={userSearch} onChange={e => setUserSearch(e.target.value)}
              style={{ ...inputStyle(), maxWidth: 260 }} />
            <select value={filterRoleId} onChange={e => setFilterRoleId(e.target.value)}
              style={{ ...inputStyle(), maxWidth: 200 }}>
              <option value="">All Roles</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <div style={{ flex: 1 }} />
            <button onClick={() => setShowInvite(true)} style={btn(RAISED, GOLD)}>+ Invite User</button>
            <button onClick={() => setShowAssign(true)} style={btn(GOLD, BG)}>+ Assign Role</button>
          </div>

          {/* ── Pending sent invites (expiry countdown + cancel / resend) ── */}
          <div style={card()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: pendingInvites.length ? 14 : 0 }}>
              <h3 style={{ color: GOLD, margin: 0, fontSize: 15 }}>Pending Invites</h3>
              {pendingInvites.length > 0 && (
                <span style={{ color: DIM, fontSize: 12 }}>
                  {pendingInvites.length} pending
                </span>
              )}
            </div>
            {pendingInvites.length === 0 ? (
              <p style={{ color: DIM, fontSize: 12, margin: 0 }}>No pending invites.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['Email', 'Role', 'Sent', 'Expires', ''].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: DIM, fontWeight: 600,
                        borderBottom: `2px solid ${BORDER}`, fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pendingInvites.map(inv => {
                    const exp = inviteExpiry(inv.created_at);
                    return (
                      <tr key={inv.id} style={{ borderBottom: `1px solid ${BORDER}15` }}>
                        <td style={{ padding: '10px 12px', color: TEXT, fontWeight: 500 }}>{inv.email}</td>
                        <td style={{ padding: '10px 12px', color: DIM }}>{inv.role || 'member'}</td>
                        <td style={{ padding: '10px 12px', color: DIM, fontSize: 12 }}>{relTimeAgo(inv.created_at)}</td>
                        <td style={{ padding: '10px 12px' }}>
                          {exp.expired ? (
                            <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 4,
                              fontSize: 11, fontWeight: 700, color: RED, background: `${RED}22`,
                              border: `1px solid ${RED}` }}>Expired</span>
                          ) : (
                            <span style={{ color: AMBER, fontSize: 12, fontWeight: 600 }}>{exp.label}</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button onClick={() => resendInvite(inv.id)}
                            style={{ ...btn('transparent', GOLD), padding: '6px 12px' }}>Resend</button>
                          <button onClick={() => cancelInvite(inv.id)}
                            style={{ ...btn('transparent', RED), padding: '6px 12px', marginLeft: 8 }}>Cancel</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div style={card()}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['User', 'Email', 'Role', 'Scope', 'Assigned', 'By', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: DIM, fontWeight: 600,
                      borderBottom: `2px solid ${BORDER}`, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAssignments.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: DIM }}>No assignments found.</td></tr>
                ) : filteredAssignments.map(a => {
                  const role = roles.find(r => r.id === a.roleId);
                  return (
                    <tr key={a.id} style={{ borderBottom: `1px solid ${BORDER}15` }}>
                      <td style={{ padding: '10px 12px', color: TEXT, fontWeight: 500 }}>{a.userName}</td>
                      <td style={{ padding: '10px 12px', color: DIM }}>{a.email}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: role?.color ?? BORDER }} />
                          <span style={{ color: TEXT, fontWeight: 500 }}>{role?.name ?? 'Unknown'}</span>
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: a.projectName ? AMBER : DIM, fontSize: 12 }}>
                        {a.projectName ?? 'Global'}
                      </td>
                      <td style={{ padding: '10px 12px', color: DIM, fontSize: 12 }}>{fmtDate(a.assignedAt)}</td>
                      <td style={{ padding: '10px 12px', color: DIM, fontSize: 12 }}>{a.assignedBy}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={() => resetUserPassword(a.userId, a.userName)}
                          style={{ ...btn('transparent', GOLD), padding: '6px 12px' }}>Reset PW</button>
                        <button onClick={() => removeAssignment(a.id)}
                          style={{ ...btn('transparent', RED), padding: '6px 12px', marginLeft: 8 }}>Remove</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: COMPARE ROLES ── */}
      {tab === 'compare' && (
        <div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle()}>Role A</label>
              <select value={compareA} onChange={e => setCompareA(e.target.value)} style={inputStyle()}>
                <option value="">Select role...</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', padding: '0 8px 8px', color: DIM, fontWeight: 700 }}>vs</div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle()}>Role B</label>
              <select value={compareB} onChange={e => setCompareB(e.target.value)} style={inputStyle()}>
                <option value="">Select role...</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>

          {roleA && roleB ? (
            <div style={card()}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: DIM, borderBottom: `2px solid ${BORDER}`, width: '30%' }}>Category</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', borderBottom: `2px solid ${BORDER}`, width: '30%' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: roleA.color }} />
                        <span style={{ color: TEXT, fontWeight: 600 }}>{roleA.name}</span>
                      </span>
                    </th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', borderBottom: `2px solid ${BORDER}`, width: '10%' }}>
                      <span style={{ color: DIM, fontSize: 11 }}>Match</span>
                    </th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', borderBottom: `2px solid ${BORDER}`, width: '30%' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: roleB.color }} />
                        <span style={{ color: TEXT, fontWeight: 600 }}>{roleB.name}</span>
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORIES.map(cat => {
                    const lA = roleA.permissions[cat] ?? 'None';
                    const lB = roleB.permissions[cat] ?? 'None';
                    const match = lA === lB;
                    return (
                      <tr key={cat} style={{ background: match ? 'transparent' : `${RED}08` }}>
                        <td style={{ padding: '10px 12px', color: TEXT, fontWeight: 500, borderBottom: `1px solid ${BORDER}15` }}>{cat}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', borderBottom: `1px solid ${BORDER}15` }}>
                          <span style={{ padding: '3px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                            color: lA === 'None' ? DIM : '#fff', background: `${permLevelColor(lA)}22`,
                            border: `1px solid ${permLevelColor(lA)}` }}>{lA}</span>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', borderBottom: `1px solid ${BORDER}15` }}>
                          {match ? (
                            <span style={{ color: GREEN, fontSize: 16 }}>=</span>
                          ) : (
                            <span style={{ color: RED, fontSize: 14, fontWeight: 700 }}>{'\u2260'}</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', borderBottom: `1px solid ${BORDER}15` }}>
                          <span style={{ padding: '3px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                            color: lB === 'None' ? DIM : '#fff', background: `${permLevelColor(lB)}22`,
                            border: `1px solid ${permLevelColor(lB)}` }}>{lB}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* summary */}
              <div style={{ marginTop: 16, display: 'flex', gap: 20, fontSize: 12, color: DIM }}>
                <span>Matching: <strong style={{ color: GREEN }}>
                  {CATEGORIES.filter(c => (roleA.permissions[c] ?? 'None') === (roleB.permissions[c] ?? 'None')).length}
                </strong> / {CATEGORIES.length}</span>
                <span>Differences: <strong style={{ color: RED }}>
                  {CATEGORIES.filter(c => (roleA.permissions[c] ?? 'None') !== (roleB.permissions[c] ?? 'None')).length}
                </strong></span>
              </div>
            </div>
          ) : (
            <div style={card()}>
              <p style={{ color: DIM, textAlign: 'center' }}>Select two roles to compare their permissions side by side.</p>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: AUDIT LOG ── */}
      {tab === 'audit' && (
        <div style={card()}>
          <h3 style={{ color: TEXT, margin: '0 0 16px', fontSize: 16 }}>Permission Change Audit Log</h3>
          {audit.length === 0 ? (
            <p style={{ color: DIM, textAlign: 'center', padding: 30 }}>No audit entries.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Action', 'Role', 'Changed By', 'Date', 'Detail'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: DIM, fontWeight: 600,
                      borderBottom: `2px solid ${BORDER}`, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {audit.map(a => {
                  let actionColor = DIM;
                  if (a.action.includes('Created') || a.action.includes('Duplicated')) actionColor = GREEN;
                  else if (a.action.includes('Updated') || a.action.includes('Override') || a.action.includes('Scope')) actionColor = AMBER;
                  else if (a.action.includes('Deleted') || a.action.includes('Unassigned')) actionColor = RED;
                  else if (a.action.includes('Assigned')) actionColor = BLUE;
                  return (
                    <tr key={a.id} style={{ borderBottom: `1px solid ${BORDER}15` }}>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ color: actionColor, fontWeight: 600, fontSize: 12 }}>{a.action}</span>
                      </td>
                      <td style={{ padding: '10px 12px', color: TEXT }}>{a.roleName}</td>
                      <td style={{ padding: '10px 12px', color: DIM, fontSize: 12 }}>{a.changedBy}</td>
                      <td style={{ padding: '10px 12px', color: DIM, fontSize: 12 }}>{fmtDateTime(a.changedAt)}</td>
                      <td style={{ padding: '10px 12px', color: DIM, fontSize: 12, maxWidth: 320 }}>{a.detail}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── MODAL: CREATE / EDIT ROLE ── */}
      <Modal open={showRoleModal} onClose={() => setShowRoleModal(false)}
        title={editRoleId ? 'Edit Role' : 'Create New Role'} width={680}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
          <div>
            <label style={labelStyle()}>Role Name</label>
            <input value={formName} onChange={e => setFormName(e.target.value)}
              placeholder="e.g. Safety Coordinator" style={inputStyle()} />
          </div>
          <div>
            <label style={labelStyle()}>Color</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ROLE_COLORS.map(c => (
                <div key={c} onClick={() => setFormColor(c)} style={{
                  width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                  border: formColor === c ? `3px solid ${TEXT}` : '3px solid transparent',
                  transition: 'border .15s',
                }} />
              ))}
            </div>
          </div>
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle()}>Description</label>
          <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)}
            placeholder="Describe what this role is for..." rows={2}
            style={{ ...inputStyle(), resize: 'vertical' }} />
        </div>

        {/* permission matrix in modal */}
        <label style={labelStyle()}>Permission Matrix</label>
        <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12, marginBottom: 18, overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '140px repeat(4, 1fr)', gap: 0, fontSize: 12 }}>
            <div style={{ padding: '6px 8px', fontWeight: 700, color: DIM }}>Category</div>
            {PERM_LEVELS.map(l => (
              <div key={l} style={{ padding: '6px 8px', fontWeight: 700, color: DIM, textAlign: 'center' }}>
                {l === 'Full' ? 'Full (CRUD+)' : l}
              </div>
            ))}
            {CATEGORIES.map(cat => (
              <React.Fragment key={cat}>
                <div style={{ padding: '6px 8px', color: TEXT, borderTop: `1px solid ${BORDER}20` }}>{cat}</div>
                {PERM_LEVELS.map(level => {
                  const isActive = formPerms[cat] === level;
                  return (
                    <div key={level} style={{ padding: '4px 8px', textAlign: 'center', borderTop: `1px solid ${BORDER}20` }}>
                      <div onClick={() => setFormPerms(prev => ({ ...prev, [cat]: level }))} style={{
                        width: 20, height: 20, borderRadius: '50%', margin: '0 auto', cursor: 'pointer',
                        border: `2px solid ${isActive ? permLevelColor(level) : BORDER}`,
                        background: isActive ? permLevelColor(level) : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all .15s',
                      }}>
                        {isActive && level !== 'None' && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>{'\u2713'}</span>}
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
          {/* quick set buttons */}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={() => setFormPerms(Object.fromEntries(CATEGORIES.map(c => [c, 'None' as PermLevel])))}
              style={{ ...btn(RAISED, DIM), fontSize: 11, padding: '4px 10px' }}>Set All None</button>
            <button onClick={() => setFormPerms(Object.fromEntries(CATEGORIES.map(c => [c, 'View' as PermLevel])))}
              style={{ ...btn(RAISED, AMBER), fontSize: 11, padding: '4px 10px' }}>Set All View</button>
            <button onClick={() => setFormPerms(Object.fromEntries(CATEGORIES.map(c => [c, 'Edit' as PermLevel])))}
              style={{ ...btn(RAISED, BLUE), fontSize: 11, padding: '4px 10px' }}>Set All Edit</button>
            <button onClick={() => setFormPerms(Object.fromEntries(CATEGORIES.map(c => [c, 'Full' as PermLevel])))}
              style={{ ...btn(RAISED, GREEN), fontSize: 11, padding: '4px 10px' }}>Set All Full</button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={() => setShowRoleModal(false)} style={btn(RAISED, DIM)}>Cancel</button>
          <button onClick={saveRole} disabled={!formName.trim()} style={{
            ...btn(GOLD, BG), opacity: formName.trim() ? 1 : 0.5,
          }}>{editRoleId ? 'Save Changes' : 'Create Role'}</button>
        </div>
      </Modal>

      {/* ── MODAL: ASSIGN ROLE TO USER ── */}
      <Modal open={showAssign} onClose={() => setShowAssign(false)} title="Assign Role to User" width={480}>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle()}>User</label>
          <select value={assignUserId} onChange={e => setAssignUserId(e.target.value)} style={inputStyle()}>
            <option value="">Select user...</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}{u.email ? ` (${u.email})` : ''}</option>)}
          </select>
          {users.length === 0 && (
            <p style={{ color: DIM, fontSize: 11, marginTop: 4 }}>No tenant users found. Invite someone first.</p>
          )}
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle()}>Role</label>
          <select value={assignRoleId} onChange={e => setAssignRoleId(e.target.value)} style={inputStyle()}>
            <option value="">Select role...</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle()}>Project Scope (optional)</label>
          <select value={assignProjectId} onChange={e => setAssignProjectId(e.target.value)} style={inputStyle()}>
            <option value="">Global (all projects)</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <p style={{ color: DIM, fontSize: 11, marginTop: 4 }}>Leave as Global to apply this role across all projects.</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={() => setShowAssign(false)} style={btn(RAISED, DIM)}>Cancel</button>
          <button onClick={assignRole} disabled={!assignUserId || !assignRoleId} style={{
            ...btn(GOLD, BG), opacity: assignUserId && assignRoleId ? 1 : 0.5,
          }}>Assign</button>
        </div>
      </Modal>

      {/* ── MODAL: INVITE USER ── */}
      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Invite User" width={480}>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle()}>Email</label>
          <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
            placeholder="name@company.com" style={inputStyle()} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle()}>Name</label>
          <input value={inviteName} onChange={e => setInviteName(e.target.value)}
            placeholder="Full name (optional)" style={inputStyle()} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle()}>Role</label>
          <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={inputStyle()}>
            <option value="">Member (default)</option>
            {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
          </select>
          <p style={{ color: DIM, fontSize: 11, marginTop: 4 }}>An invite email is recorded and the team is notified.</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={() => setShowInvite(false)} style={btn(RAISED, DIM)}>Cancel</button>
          <button onClick={sendInvite} disabled={!inviteEmail.trim()} style={{
            ...btn(GOLD, BG), opacity: inviteEmail.trim() ? 1 : 0.5,
          }}>Send Invite</button>
        </div>
      </Modal>

      {/* ── TOAST ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9500,
          background: RAISED, border: `1px solid ${toast.kind === 'err' ? RED : GREEN}`,
          borderLeft: `4px solid ${toast.kind === 'err' ? RED : GREEN}`, borderRadius: 8,
          padding: '12px 18px', color: TEXT, fontSize: 13, fontWeight: 600,
          boxShadow: '0 8px 28px rgba(0,0,0,0.45)', maxWidth: 340,
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
