'use client';
/**
 * Settings → External Storage. Connect the tenant's own cloud storage (S3-compatible,
 * Egnyte, OneDrive/SharePoint, Dropbox, Google Drive, Box), test/remove connections,
 * and browse+import external files into a project. OAuth providers bounce through the
 * provider's consent screen; keys/token providers use an inline form. Secrets are
 * AES-encrypted server-side and never returned to the browser.
 */
import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { humanError } from '@/lib/errors';
import { useSearchParams } from 'next/navigation';
import { PageWrap, SectionHeader, Btn, Card, T } from '@/components/ui/shell';
import { CloudArrowUp, Plus, X, CheckCircle, WarningCircle, ArrowClockwise, Trash, Gear, LinkSimple, CaretDown, CaretRight } from '@phosphor-icons/react';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Field = { key: string; label: string; required?: boolean; placeholder?: string; secret?: boolean };
const FORM_FIELDS: Record<string, Field[]> = {
  s3: [
    { key: 'region', label: 'Region', required: true, placeholder: 'us-east-1 (use "auto" for Cloudflare R2)' },
    { key: 'bucket', label: 'Bucket name', required: true, placeholder: 'my-company-files' },
    { key: 'endpoint', label: 'Custom endpoint (S3-compatible only)', placeholder: 'https://<acct>.r2.cloudflarestorage.com' },
    { key: 'forcePathStyle', label: 'Force path-style (MinIO/most non-AWS) — true/false', placeholder: 'false' },
    { key: 'accessKeyId', label: 'Access key ID', required: true, secret: true },
    { key: 'secretAccessKey', label: 'Secret access key', required: true, secret: true },
  ],
  egnyte: [
    { key: 'domain', label: 'Egnyte domain', required: true, placeholder: 'acme.egnyte.com' },
    { key: 'apiToken', label: 'API access token', required: true, secret: true },
  ],
};

export default function StorageSettingsPage() {
  return <Suspense fallback={<PageWrap><div style={{ padding: 40, color: T.muted }}>Loading…</div></PageWrap>}><StorageSettings /></Suspense>;
}

function StorageSettings() {
  const qp = useSearchParams();
  const [providers, setProviders] = useState<any[]>([]);
  const [connectors, setConnectors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);
  const [toast, setToast] = useState<{ m: string; ok: boolean } | null>(null);
  const flash = (m: string, ok = true) => { setToast({ m, ok }); setTimeout(() => setToast(null), 4000); };

  const load = useCallback(async () => {
    setLoading(true);
    const [p, c] = await Promise.all([fetch('/api/storage/providers').then((r) => r.json()), fetch('/api/storage/connectors').then((r) => r.json())]);
    setProviders(p.providers ?? []); setConnectors(c.connectors ?? []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const connected = qp.get('connected'); const error = qp.get('error');
    if (connected) { flash(`Connected ${connected} ✓`); window.history.replaceState({}, '', '/app/settings/storage'); }
    if (error) { flash(error, false); window.history.replaceState({}, '', '/app/settings/storage'); }
  }, [qp]);

  const startAdd = (provider: string, auth: string) => {
    if (auth === 'oauth') { window.location.href = `/api/storage/oauth/${provider}/start`; return; }
    setAdding(provider); setForm({});
  };
  const submitForm = async () => {
    const fields = FORM_FIELDS[adding!] || [];
    const config: any = {}; const secret: any = {};
    for (const f of fields) {
      const v = (form[f.key] ?? '').trim();
      if (f.required && !v) { flash(`${f.label} is required`, false); return; }
      if (!v) continue;
      if (f.secret) secret[f.key] = v;
      else config[f.key] = f.key === 'forcePathStyle' ? v === 'true' : v;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/storage/connectors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: adding, config, secret }) });
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      flash(`Connected${j.account ? ` — ${j.account}` : ''} ✓`); setAdding(null); load();
    } catch (e: any) { console.error(e); flash(humanError(e, 'Something went wrong. Please try again.'), false); }
    setBusy(false);
  };
  const test = async (id: string) => { const j = await (await fetch(`/api/storage/connectors/${id}/test`, { method: 'POST' })).json(); flash(j.ok ? `Connection OK${j.account ? ` — ${j.account}` : ''}` : (j.error || 'Test failed'), j.ok); load(); };
  const remove = async (id: string, name: string) => { if (!confirm(`Remove "${name}"? Files already imported stay; new access stops.`)) return; await fetch(`/api/storage/connectors/${id}`, { method: 'DELETE' }); flash('Removed'); load(); };
  const saveConfig = async (id: string, config: any) => { const j = await (await fetch(`/api/storage/connectors/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config }) })).json(); if (j.error) flash(j.error, false); else { flash('Saved'); load(); } };

  return (
    <PageWrap>
      <div style={{ padding: 24, maxWidth: 900 }}>
        <SectionHeader title="External Storage" sub="Connect your company's cloud in one click — your team signs in with the account they already use, no keys to manage. Browse it, import into projects, and export back out." />

        {toast && <div style={{ margin: '8px 0 16px', padding: '10px 14px', background: toast.ok ? T.greenDim : 'rgba(255,59,48,0.12)', border: `1px solid ${toast.ok ? 'rgba(52,199,89,0.3)' : 'rgba(255,59,48,0.3)'}`, borderRadius: 8, color: toast.ok ? T.green : T.red, fontSize: 13 }}>{toast.m}</div>}

        {/* existing connections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 26 }}>
          {loading ? <div style={{ color: T.muted, padding: 12 }}>Loading…</div>
            : connectors.length === 0 ? <Card><div style={{ padding: 18, color: T.muted, fontSize: 14 }}>No storage connected yet. Add one below.</div></Card>
              : connectors.map((c) => <ConnectorCard key={c.id} c={c} onTest={() => test(c.id)} onRemove={() => remove(c.id, c.display_name)} onSaveConfig={(cfg) => saveConfig(c.id, cfg)} />)}
        </div>

        {/* one-click OAuth providers — the mainstream, no keys */}
        {(() => {
          const oneClick = providers.filter((p) => p.auth === 'oauth');
          const advanced = providers.filter((p) => p.auth !== 'oauth');
          const anyOneClick = oneClick.some((p) => p.available);
          return (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.white, marginBottom: 4 }}>Connect in one click</div>
              <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 12 }}>Your team signs in with their existing account — no API keys, nothing to paste.</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12 }}>
                {oneClick.map((p) => (
                  <button key={p.id} disabled={!p.available} onClick={() => startAdd(p.id, p.auth)}
                    style={{ textAlign: 'left', background: T.surface2, border: `1px solid ${p.available ? T.border : 'rgba(255,255,255,0.06)'}`, borderRadius: 12, padding: 14, cursor: p.available ? 'pointer' : 'default', opacity: p.available ? 1 : 0.5, color: T.white }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CloudArrowUp size={18} color={T.gold} weight="fill" /><span style={{ fontWeight: 700, fontSize: 14 }}>{p.label}</span></div>
                    <div style={{ color: T.muted, fontSize: 12, marginTop: 6, lineHeight: 1.4 }}>{p.blurb}</div>
                    <div style={{ marginTop: 8, fontSize: 11.5, color: p.available ? T.gold : T.muted }}>{p.available ? 'Connect with sign-in →' : 'Enabling soon'}</div>
                  </button>
                ))}
              </div>
              {!anyOneClick && <div style={{ fontSize: 12, color: T.muted, marginTop: 10 }}>One-click providers activate once your Saguaro workspace is configured. Use an advanced option below in the meantime.</div>}

              {/* advanced: self-managed keys (S3 bucket, Egnyte token) */}
              <button onClick={() => setAdvOpen((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: T.muted, marginTop: 26, padding: 0, fontSize: 13, fontWeight: 700 }}>
                {advOpen ? <CaretDown size={14} /> : <CaretRight size={14} />}Advanced — bring your own bucket
              </button>
              {advOpen && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12, marginTop: 12 }}>
                  {advanced.map((p) => (
                    <button key={p.id} onClick={() => startAdd(p.id, p.auth)}
                      style={{ textAlign: 'left', background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, cursor: 'pointer', color: T.white }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CloudArrowUp size={18} color={T.muted} weight="fill" /><span style={{ fontWeight: 700, fontSize: 14 }}>{p.label}</span></div>
                      <div style={{ color: T.muted, fontSize: 12, marginTop: 6, lineHeight: 1.4 }}>{p.blurb}</div>
                      <div style={{ marginTop: 8, fontSize: 11.5, color: T.gold }}>Enter credentials →</div>
                    </button>
                  ))}
                </div>
              )}
            </>
          );
        })()}
      </div>

      {adding && (
        <div onClick={() => setAdding(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 14, padding: 18, width: 'min(460px,100%)', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}><div style={{ fontWeight: 800, fontSize: 16, flex: 1, color: T.white }}>Connect {providers.find((p) => p.id === adding)?.label}</div><button onClick={() => setAdding(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={19} color={T.muted} /></button></div>
            {(FORM_FIELDS[adding] || []).map((f) => (
              <label key={f.key} style={{ display: 'block', marginBottom: 10 }}>
                <span style={{ fontSize: 12.5, color: T.muted }}>{f.label}{f.required ? ' *' : ''}</span>
                <input type={f.secret ? 'password' : 'text'} autoComplete="off" value={form[f.key] ?? ''} placeholder={f.placeholder}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  style={{ width: '100%', marginTop: 3, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, color: T.white, padding: '9px 11px', fontSize: 13.5, fontFamily: f.secret ? 'monospace' : undefined }} />
              </label>
            ))}
            <Btn onClick={submitForm} disabled={busy} style={{ width: '100%', marginTop: 6 }}>{busy ? 'Verifying…' : 'Test & connect'}</Btn>
            <div style={{ fontSize: 11.5, color: T.muted, marginTop: 10, lineHeight: 1.5 }}>Credentials are encrypted server-side and never shown again. We verify them before saving.</div>
          </div>
        </div>
      )}
    </PageWrap>
  );
}

function ConnectorCard({ c, onTest, onRemove, onSaveConfig }: { c: any; onTest: () => void; onRemove: () => void; onSaveConfig: (cfg: any) => void }) {
  const [cfg, setCfg] = useState<any>(c.config || {});
  const needsSite = c.provider === 'sharepoint' && !c.config?.siteId;
  return (
    <Card>
      <div style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {c.connected ? <CheckCircle size={22} color={T.green} weight="fill" /> : <WarningCircle size={22} color={T.red} weight="fill" />}
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontWeight: 700, color: T.white, fontSize: 14.5 }}>{c.display_name}</div>
          <div style={{ fontSize: 12, color: c.connected ? T.muted : T.red }}>{c.connected ? `Connected${c.last_verified_at ? ` · verified ${new Date(c.last_verified_at).toLocaleDateString()}` : ''}` : (c.last_error || 'Not connected')}</div>
        </div>
        <Btn size="sm" variant="ghost" onClick={onTest}><ArrowClockwise size={14} />Test</Btn>
        <Btn size="sm" variant="danger" onClick={onRemove}><Trash size={14} />Remove</Btn>
      </div>
      {needsSite && (
        <div style={{ padding: '0 14px 14px', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <label style={{ flex: 1 }}><span style={{ fontSize: 11.5, color: T.muted }}>SharePoint Site ID (required to browse)</span>
            <input value={cfg.siteId || ''} onChange={(e) => setCfg({ ...cfg, siteId: e.target.value })} placeholder="contoso.sharepoint.com,<siteGuid>,<webGuid>"
              style={{ width: '100%', marginTop: 3, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, color: T.white, padding: '8px 10px', fontSize: 12.5 }} /></label>
          <Btn size="sm" onClick={() => onSaveConfig(cfg)}><Gear size={13} />Save</Btn>
        </div>
      )}
    </Card>
  );
}
