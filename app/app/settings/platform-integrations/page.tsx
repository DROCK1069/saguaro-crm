'use client';
/**
 * Platform Integrations (super-admin only). Configure each cloud provider's OAuth
 * app ONCE, in-product — paste the client id + secret from the provider's console,
 * and every tenant instantly gets one-click connect. Secrets are AES-encrypted;
 * only the client id is ever shown back. Gated to PLATFORM_ADMIN_EMAILS.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { humanError } from '@/lib/errors';
import { PageWrap, SectionHeader, Btn, Card, T } from '@/components/ui/shell';
import { ShieldCheck, CheckCircle, WarningCircle, X, Copy, Check, ArrowSquareOut, Trash } from '@phosphor-icons/react';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function PlatformIntegrationsPage() {
  const [apps, setApps] = useState<any[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<{ clientId: string; clientSecret: string }>({ clientId: '', clientSecret: '' });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ m: string; ok: boolean } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const flash = (m: string, ok = true) => { setToast({ m, ok }); setTimeout(() => setToast(null), 4000); };

  const load = useCallback(async () => {
    const res = await fetch('/api/platform/integrations');
    if (res.status === 403) { setDenied(true); return; }
    const j = await res.json();
    setApps(j.apps ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.clientId.trim() || !form.clientSecret.trim()) { flash('Client ID and secret are both required', false); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/platform/integrations/${editing.app}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      flash(`${editing.label} connected — live for all tenants`); setEditing(null); setForm({ clientId: '', clientSecret: '' }); load();
    } catch (e: any) { console.error(e); flash(humanError(e, 'Something went wrong. Please try again.'), false); }
    setBusy(false);
  };
  const remove = async (app: any) => { if (!confirm(`Remove ${app.label} credentials? Tenants can't connect it until re-added.`)) return; await fetch(`/api/platform/integrations/${app.app}`, { method: 'DELETE' }); flash('Removed'); load(); };
  const copy = async (text: string, key: string) => { try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500); } catch { /* */ } };

  if (denied) return <PageWrap><div style={{ padding: 40, color: T.muted }}><ShieldCheck size={28} color={T.muted} /><div style={{ marginTop: 10, fontSize: 15 }}>Platform owners only.</div></div></PageWrap>;

  return (
    <PageWrap>
      <div style={{ padding: 24, maxWidth: 860 }}>
        <SectionHeader title="Platform Integrations" sub="Configure each cloud provider's app once. After that, every tenant gets one-click connect — they just sign in with their own account, no keys." />

        {toast && <div style={{ margin: '8px 0 16px', padding: '10px 14px', background: toast.ok ? T.greenDim : 'rgba(255,59,48,0.12)', border: `1px solid ${toast.ok ? 'rgba(52,199,89,0.3)' : 'rgba(255,59,48,0.3)'}`, borderRadius: 8, color: toast.ok ? T.green : T.red, fontSize: 13 }}>{toast.m}</div>}

        {apps === null ? <div style={{ color: T.muted, padding: 12 }}>Loading…</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {apps.map((a) => (
              <Card key={a.app}>
                <div style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    {a.configured ? <CheckCircle size={22} color={T.green} weight="fill" /> : <WarningCircle size={22} color={T.muted} weight="fill" />}
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontWeight: 700, color: T.white, fontSize: 15 }}>{a.label}</div>
                      <div style={{ fontSize: 12, color: T.muted }}>{a.configured ? `Configured (${a.source})${a.client_id ? ` · ${a.client_id.slice(0, 10)}…` : ''}` : 'Not configured — tenants can\'t connect this yet'}</div>
                    </div>
                    <Btn size="sm" onClick={() => { setEditing(a); setForm({ clientId: '', clientSecret: '' }); }}>{a.configured ? 'Update' : 'Set up'}</Btn>
                    {a.source === 'in-product' && <Btn size="sm" variant="danger" onClick={() => remove(a)}><Trash size={13} /></Btn>}
                  </div>
                </div>
              </Card>
            ))}
          </div>}
      </div>

      {editing && (
        <div onClick={() => setEditing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 14, padding: 18, width: 'min(560px,100%)', maxHeight: '92vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}><div style={{ fontWeight: 800, fontSize: 16, flex: 1, color: T.white }}>{editing.label}</div><button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={19} color={T.muted} /></button></div>

            {/* setup guide */}
            <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: 12, margin: '10px 0 14px' }}>
              <div style={{ fontSize: 12.5, color: T.white, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>1 · Register the app <a href={editing.portal} target="_blank" rel="noreferrer" style={{ color: T.gold, display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>{editing.portalName}<ArrowSquareOut size={12} /></a></div>
              <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 8 }}>Add these redirect URIs to the app (copy each):</div>
              {editing.redirects.map((r: string) => (
                <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <code style={{ flex: 1, fontSize: 11.5, color: '#3dd68c', wordBreak: 'break-all', fontFamily: 'monospace' }}>{r}</code>
                  <button onClick={() => copy(r, r)} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, padding: '3px 7px', cursor: 'pointer', color: T.muted, display: 'inline-flex', gap: 3, alignItems: 'center', fontSize: 11 }}>{copied === r ? <Check size={12} color={T.green} /> : <Copy size={12} />}</button>
                </div>
              ))}
              <div style={{ fontSize: 11.5, color: T.muted, marginTop: 6 }}>Enables: {editing.providers.join(', ')}.</div>
            </div>

            <div style={{ fontSize: 12.5, color: T.white, fontWeight: 700, marginBottom: 8 }}>2 · Paste the app credentials</div>
            <label style={{ display: 'block', marginBottom: 10 }}><span style={{ fontSize: 12.5, color: T.muted }}>Client ID / App key</span>
              <input value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} autoComplete="off" style={{ width: '100%', marginTop: 3, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, color: T.white, padding: '9px 11px', fontSize: 13.5, fontFamily: 'monospace' }} /></label>
            <label style={{ display: 'block', marginBottom: 10 }}><span style={{ fontSize: 12.5, color: T.muted }}>Client secret / App secret</span>
              <input type="password" value={form.clientSecret} onChange={(e) => setForm({ ...form, clientSecret: e.target.value })} autoComplete="off" style={{ width: '100%', marginTop: 3, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, color: T.white, padding: '9px 11px', fontSize: 13.5, fontFamily: 'monospace' }} /></label>
            <Btn onClick={save} disabled={busy} style={{ width: '100%', marginTop: 4 }}>{busy ? 'Saving…' : 'Save — go live for all tenants'}</Btn>
            <div style={{ fontSize: 11.5, color: T.muted, marginTop: 10, lineHeight: 1.5 }}>The secret is AES-encrypted server-side and never shown again. The client ID isn't a secret.</div>
          </div>
        </div>
      )}
    </PageWrap>
  );
}
