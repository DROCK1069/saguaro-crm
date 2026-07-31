'use client';
/**
 * Settings → Integration Hub. A marketplace of first-class integrations plus
 * self-serve developer tooling: personal API keys (one-time secret reveal) and
 * outbound webhooks (signed delivery, per-event subscriptions, live test).
 * All secrets live only in the DB — the API key's full value is shown exactly
 * once at creation and never returned again.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { humanError } from '@/lib/errors';
import Link from 'next/link';
import { PageWrap, SectionHeader, Btn, Card, CardHeader, CardBody, Badge, T } from '@/components/ui/shell';
import {
  Plugs, Key, Plus, Copy, Check, Trash, Broadcast, ArrowSquareOut,
  Warning, LinkSimple, X,
} from '@phosphor-icons/react';
import { WEBHOOK_EVENT_NAMES } from '@/lib/webhook-events';

/* eslint-disable @typescript-eslint/no-explicit-any */

type MarketState = 'connect' | 'request' | 'soon';
type Market = { key: string; name: string; desc: string; state: MarketState; href?: string };

const MARKETPLACE: Market[] = [
  { key: 'quickbooks', name: 'QuickBooks Online', desc: 'Sync invoices, bills, vendors, and customers with QuickBooks.', state: 'connect', href: '/app/integrations/quickbooks' },
  { key: 'storage', name: 'Cloud Storage', desc: 'Connect S3, OneDrive, SharePoint, Egnyte, Dropbox, Google Drive, or Box.', state: 'connect', href: '/app/settings/storage' },
  { key: 'zapier', name: 'Zapier', desc: 'Automate 6,000+ apps with Saguaro triggers and actions.', state: 'request', href: 'mailto:support@saguarocontrol.net?subject=Zapier%20Integration%20Access' },
  { key: 'slack', name: 'Slack', desc: 'Post project events and approvals to your Slack channels.', state: 'soon' },
  { key: 'teams', name: 'Microsoft Teams', desc: 'Route notifications and approvals into Teams channels.', state: 'soon' },
  { key: 'procore', name: 'Procore Import', desc: 'Migrate projects, contacts, and documents from Procore.', state: 'request', href: 'mailto:support@saguarocontrol.net?subject=Procore%20Import' },
  { key: 'autodesk', name: 'Autodesk Construction Cloud', desc: 'Sync drawings and models with Autodesk BIM 360 / ACC.', state: 'soon' },
];

// Subscribe only to events Saguaro actually emits (single source of truth:
// lib/webhook-events.ts) so registered webhooks fire instead of showing "Never fired".
const WEBHOOK_EVENTS = WEBHOOK_EVENT_NAMES;

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 10,
  background: T.surface,
  border: `1px solid ${T.border}`,
  color: T.white,
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 6 };

export default function IntegrationsHubPage() {
  const [keys, setKeys] = useState<any[]>([]);
  const [hooks, setHooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // API key create
  const [keyName, setKeyName] = useState('');
  const [keyScopes, setKeyScopes] = useState<string[]>(['read']);
  const [creatingKey, setCreatingKey] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Webhook create
  const [showHookForm, setShowHookForm] = useState(false);
  const [hookName, setHookName] = useState('');
  const [hookUrl, setHookUrl] = useState('');
  const [hookEvents, setHookEvents] = useState<string[]>([]);
  const [savingHook, setSavingHook] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  const [toast, setToast] = useState<{ m: string; ok: boolean } | null>(null);
  const flash = (m: string, ok = true) => { setToast({ m, ok }); setTimeout(() => setToast(null), 4000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [k, w] = await Promise.all([
        fetch('/api/integrations/api-keys').then((r) => r.json()),
        fetch('/api/integrations/webhooks').then((r) => r.json()),
      ]);
      setKeys(k.keys ?? []);
      setHooks(w.webhooks ?? []);
    } catch {
      flash('Failed to load integrations', false);
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleScope = (s: string) =>
    setKeyScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  const toggleEvent = (e: string) =>
    setHookEvents((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));

  const createKey = async () => {
    if (!keyName.trim()) { flash('Name the key first', false); return; }
    setCreatingKey(true);
    try {
      const res = await fetch('/api/integrations/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: keyName.trim(), scopes: keyScopes.length ? keyScopes : ['read'] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Create failed');
      setRevealed(data.secret);
      setCopied(false);
      setKeyName('');
      setKeyScopes(['read']);
      await load();
    } catch (e: any) {
      console.error(e); flash(humanError(e, 'Create failed. Please try again.'), false);
    }
    setCreatingKey(false);
  };

  const revokeKey = async (id: string) => {
    try {
      const res = await fetch(`/api/integrations/api-keys/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      flash('Key revoked');
      await load();
    } catch { flash('Revoke failed', false); }
  };

  const createHook = async () => {
    if (!hookName.trim()) { flash('Name the webhook', false); return; }
    if (!hookUrl.trim()) { flash('Endpoint URL required', false); return; }
    if (hookEvents.length === 0) { flash('Pick at least one event', false); return; }
    setSavingHook(true);
    try {
      const res = await fetch('/api/integrations/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: hookName.trim(), url: hookUrl.trim(), events: hookEvents }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Create failed');
      flash('Webhook added');
      setShowHookForm(false);
      setHookName(''); setHookUrl(''); setHookEvents([]);
      await load();
    } catch (e: any) {
      console.error(e); flash(humanError(e, 'Create failed. Please try again.'), false);
    }
    setSavingHook(false);
  };

  const toggleHookActive = async (h: any) => {
    try {
      const res = await fetch(`/api/integrations/webhooks/${h.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !h.active }),
      });
      if (!res.ok) throw new Error();
      await load();
    } catch { flash('Update failed', false); }
  };

  const deleteHook = async (id: string) => {
    try {
      const res = await fetch(`/api/integrations/webhooks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      flash('Webhook deleted');
      await load();
    } catch { flash('Delete failed', false); }
  };

  const testHook = async (id: string) => {
    setTesting(id);
    try {
      const res = await fetch(`/api/integrations/webhooks/${id}/test`, { method: 'POST' });
      const data = await res.json();
      flash(data.success ? `Test delivered (HTTP ${data.status})` : `Test failed (${data.status || 'no response'})`, !!data.success);
      await load();
    } catch { flash('Test failed', false); }
    setTesting(null);
  };

  const copyKey = () => {
    if (!revealed) return;
    navigator.clipboard?.writeText(revealed);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusColor = (s: number | null): 'green' | 'red' | 'muted' => {
    if (s == null) return 'muted';
    if (s >= 200 && s < 300) return 'green';
    return 'red';
  };

  return (
    <PageWrap>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 80px' }}>
        <SectionHeader
          title="Integration Hub"
          sub="Connect Saguaro to the tools you already use, or build your own with API keys and webhooks."
        />

        {/* Marketplace */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
            marginBottom: 40,
          }}
        >
          {MARKETPLACE.map((m) => (
            <Card key={m.key} style={{ display: 'flex', flexDirection: 'column' }}>
              <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: T.goldDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Plugs size={22} color={T.gold} weight="duotone" />
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.white }}>{m.name}</div>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.5, flex: 1 }}>{m.desc}</p>
                <div style={{ marginTop: 6 }}>
                  {m.state === 'connect' && m.href && (
                    <Link href={m.href} style={{ textDecoration: 'none' }}>
                      <Btn size="sm" variant="primary" style={{ width: '100%' }}>
                        <LinkSimple size={14} weight="bold" /> Connect
                      </Btn>
                    </Link>
                  )}
                  {m.state === 'request' && m.href && (
                    <a href={m.href} style={{ textDecoration: 'none' }}>
                      <Btn size="sm" variant="ghost" style={{ width: '100%' }}>
                        <ArrowSquareOut size={14} weight="bold" /> Request access
                      </Btn>
                    </a>
                  )}
                  {m.state === 'soon' && (
                    <div style={{ textAlign: 'center' }}>
                      <Badge label="Coming soon" color="muted" />
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>

        {/* API Keys */}
        <Card style={{ marginBottom: 32 }}>
          <CardHeader>
            <Key size={20} color={T.gold} weight="duotone" />
            <div style={{ fontSize: 16, fontWeight: 700, color: T.white }}>API Keys</div>
          </CardHeader>
          <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <p style={{ margin: 0, fontSize: 13, color: T.muted }}>
              Personal keys for the Saguaro REST API. The full key is shown once at creation — store it securely; it cannot be retrieved again.
            </p>

            {/* One-time reveal */}
            {revealed && (
              <div style={{ border: `1px solid ${T.borderGold}`, background: T.goldDim, borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Warning size={16} color={T.gold} weight="fill" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.gold }}>Copy this key now — you won&apos;t see it again</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <code style={{ flex: 1, fontFamily: 'monospace', fontSize: 13, color: T.white, background: T.surface, padding: '10px 12px', borderRadius: 8, wordBreak: 'break-all' }}>
                    {revealed}
                  </code>
                  <Btn size="sm" variant="ghost" onClick={copyKey}>
                    {copied ? <><Check size={14} weight="bold" /> Copied</> : <><Copy size={14} weight="bold" /> Copy</>}
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={() => setRevealed(null)}><X size={14} weight="bold" /></Btn>
                </div>
              </div>
            )}

            {/* Create form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, background: T.surface, borderRadius: 12, border: `1px solid ${T.border}` }}>
              <div>
                <label style={labelStyle}>Key name</label>
                <input style={inputStyle} placeholder="e.g. Reporting pipeline" value={keyName} onChange={(e) => setKeyName(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Scopes</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['read', 'write', 'admin'].map((s) => {
                    const on = keyScopes.includes(s);
                    return (
                      <button
                        key={s}
                        onClick={() => toggleScope(s)}
                        style={{
                          padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          border: `1px solid ${on ? T.borderGold : T.border}`,
                          background: on ? T.goldDim : T.surface2,
                          color: on ? T.gold : T.muted,
                          textTransform: 'uppercase', letterSpacing: '0.04em',
                        }}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Btn variant="primary" size="sm" onClick={createKey} disabled={creatingKey}>
                  <Plus size={14} weight="bold" /> {creatingKey ? 'Creating…' : 'Create API key'}
                </Btn>
              </div>
            </div>

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {loading && <div style={{ fontSize: 13, color: T.muted }}>Loading…</div>}
              {!loading && keys.length === 0 && <div style={{ fontSize: 13, color: T.faint }}>No API keys yet.</div>}
              {keys.map((k) => (
                <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: T.surface, borderRadius: 10, border: `1px solid ${T.border}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.white }}>{k.name}</div>
                    <div style={{ fontSize: 12, color: T.faint, fontFamily: 'monospace', marginTop: 2 }}>{k.key_prefix}••••••••</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(k.scopes ?? []).map((s: string) => <Badge key={s} label={s} color="blue" />)}
                  </div>
                  {k.revoked_at
                    ? <Badge label="Revoked" color="red" />
                    : <Btn size="sm" variant="danger" onClick={() => revokeKey(k.id)}><Trash size={14} weight="bold" /> Revoke</Btn>}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Outbound Webhooks */}
        <Card>
          <CardHeader>
            <Broadcast size={20} color={T.gold} weight="duotone" />
            <div style={{ fontSize: 16, fontWeight: 700, color: T.white, flex: 1 }}>Outbound Webhooks</div>
            <Btn size="sm" variant="ghost" onClick={() => setShowHookForm((v) => !v)}>
              <Plus size={14} weight="bold" /> Add endpoint
            </Btn>
          </CardHeader>
          <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <p style={{ margin: 0, fontSize: 13, color: T.muted }}>
              Saguaro POSTs a JSON event to your URL with an <code style={{ fontFamily: 'monospace', color: T.white }}>X-Saguaro-Signature</code> HMAC-SHA256 header you can verify with the endpoint&apos;s secret.
            </p>

            {showHookForm && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, background: T.surface, borderRadius: 12, border: `1px solid ${T.border}` }}>
                <div>
                  <label style={labelStyle}>Name</label>
                  <input style={inputStyle} placeholder="e.g. Ops notifier" value={hookName} onChange={(e) => setHookName(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Endpoint URL</label>
                  <input style={inputStyle} placeholder="https://example.com/webhooks/saguaro" value={hookUrl} onChange={(e) => setHookUrl(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Events</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {WEBHOOK_EVENTS.map((e) => {
                      const on = hookEvents.includes(e);
                      return (
                        <button
                          key={e}
                          onClick={() => toggleEvent(e)}
                          style={{
                            padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            border: `1px solid ${on ? T.borderGold : T.border}`,
                            background: on ? T.goldDim : T.surface2,
                            color: on ? T.gold : T.muted, fontFamily: 'monospace',
                          }}
                        >
                          {e}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn variant="primary" size="sm" onClick={createHook} disabled={savingHook}>
                    {savingHook ? 'Saving…' : 'Add webhook'}
                  </Btn>
                  <Btn variant="ghost" size="sm" onClick={() => setShowHookForm(false)}>Cancel</Btn>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {loading && <div style={{ fontSize: 13, color: T.muted }}>Loading…</div>}
              {!loading && hooks.length === 0 && <div style={{ fontSize: 13, color: T.faint }}>No webhooks configured.</div>}
              {hooks.map((h) => (
                <div key={h.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px', background: T.surface, borderRadius: 10, border: `1px solid ${T.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.white }}>{h.name}</div>
                      <div style={{ fontSize: 12, color: T.faint, wordBreak: 'break-all', marginTop: 2 }}>{h.url}</div>
                    </div>
                    <Badge label={h.active ? 'Active' : 'Paused'} color={h.active ? 'green' : 'muted'} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(h.events ?? []).map((e: string) => (
                      <span key={e} style={{ fontSize: 11, fontFamily: 'monospace', color: T.muted, background: T.surface2, padding: '2px 8px', borderRadius: 6, border: `1px solid ${T.border}` }}>{e}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {h.last_status != null
                      ? <Badge label={`Last: HTTP ${h.last_status}`} color={statusColor(h.last_status)} />
                      : <span style={{ fontSize: 12, color: T.faint }}>Never fired</span>}
                    {h.last_fired_at && <span style={{ fontSize: 12, color: T.faint }}>{new Date(h.last_fired_at).toLocaleString()}</span>}
                    <div style={{ flex: 1 }} />
                    <Btn size="sm" variant="ghost" onClick={() => testHook(h.id)} disabled={testing === h.id}>
                      {testing === h.id ? 'Testing…' : 'Test'}
                    </Btn>
                    <Btn size="sm" variant="ghost" onClick={() => toggleHookActive(h)}>
                      {h.active ? 'Pause' : 'Activate'}
                    </Btn>
                    <Btn size="sm" variant="danger" onClick={() => deleteHook(h.id)}><Trash size={14} weight="bold" /></Btn>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? T.green : T.red, color: '#fff', padding: '12px 20px',
          borderRadius: 10, fontSize: 14, fontWeight: 600, boxShadow: T.shadowLg, zIndex: 1000,
        }}>
          {toast.m}
        </div>
      )}
    </PageWrap>
  );
}
