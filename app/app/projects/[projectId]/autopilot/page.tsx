'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Badge, Btn, Table, T } from '@/components/ui/shell';
import {
  PremiumSurface, ModuleHero, StatCard, SectionCard, PremiumEmpty, goldButtonStyle,
} from '@/components/ui/premium';
import { Bell, WarningCircle, Warning, CheckCircle, Sparkle, Lightning } from '@phosphor-icons/react';

interface Alert {
  id: string;
  severity: string;
  alert_type: string;
  message: string;
  date: string;
  status: string;
}

const SEVERITY_BADGE: Record<string, 'red' | 'amber' | 'gold' | 'blue' | 'muted'> = {
  critical: 'red',
  high: 'amber',
  medium: 'gold',
  low: 'blue',
  info: 'muted',
};

// Palette aligned with the dashboard kit (desert-dusk semantic accents).
const GOLD = '#F59E0B';
const RED = '#E0644E';
const AMBER = '#F0A63C';
const GREEN = '#45B37D';

export default function AutopilotPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState('');
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/autopilot/alerts?projectId=${projectId}`);
      const data = await res.json();
      setAlerts(data.alerts ?? []);
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  async function runScan() {
    setRunning(true);
    try {
      const res = await fetch('/api/internal/autopilot/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'scan failed');
      setToast(data.summary || data.message || 'Autopilot scan complete.');
      await fetchAlerts();
    } catch {
      setToast('Could not run the Autopilot scan. Please try again.');
    } finally {
      setRunning(false);
      setTimeout(() => setToast(''), 5000);
    }
  }

  async function dismissAlert(alertId: string) {
    setDismissingId(alertId);
    setAlerts(prev => prev.filter(a => a.id !== alertId));
    try {
      const res = await fetch('/api/autopilot/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, projectId }),
      });
      if (!res.ok) throw new Error('dismiss failed');
    } catch {
      setToast('Could not dismiss the alert. Please try again.');
      setTimeout(() => setToast(''), 4000);
      fetchAlerts();
    } finally {
      setDismissingId(null);
    }
  }

  const activeAlerts = alerts.filter(a => a.status !== 'dismissed');
  const criticalCount = activeAlerts.filter(a => a.severity === 'critical').length;
  const highCount = activeAlerts.filter(a => a.severity === 'high').length;
  const isClear = activeAlerts.length === 0;

  const scanButton = (
    <button
      onClick={runScan}
      disabled={running}
      className="pmBtn"
      style={{ ...goldButtonStyle, opacity: running ? 0.6 : 1, cursor: running ? 'not-allowed' : 'pointer' }}
    >
      <Lightning size={15} weight="fill" />
      {running ? 'Scanning…' : 'Run Autopilot Scan'}
    </button>
  );

  return (
    <PremiumSurface maxWidth={1600}>
      {/* Header */}
      <ModuleHero
        eyebrow="AI Monitoring"
        eyebrowIcon={<Sparkle size={13} weight="fill" color={GOLD} />}
        title="Project"
        accent="Autopilot"
        subtitle="AI-powered project alerts and monitoring."
        actions={scanButton}
      />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard
          icon={<Bell size={19} weight="duotone" color={GOLD} />}
          label="Active Alerts"
          value={String(activeAlerts.length)}
          accent={activeAlerts.length ? GOLD : undefined}
          sub={activeAlerts.length === 1 ? '1 open on this project' : `${activeAlerts.length} open on this project`}
          delay={0.02}
        />
        <StatCard
          icon={<WarningCircle size={19} weight="duotone" color={RED} />}
          label="Critical"
          value={String(criticalCount)}
          accent={criticalCount ? RED : undefined}
          sub="need immediate action"
          delay={0.06}
        />
        <StatCard
          icon={<Warning size={19} weight="duotone" color={AMBER} />}
          label="High"
          value={String(highCount)}
          accent={highCount ? AMBER : undefined}
          sub="review soon"
          delay={0.10}
        />
        <StatCard
          icon={isClear
            ? <CheckCircle size={19} weight="duotone" color={GREEN} />
            : <WarningCircle size={19} weight="duotone" color={AMBER} />}
          label="Status"
          value={isClear ? 'Clear' : 'Action Needed'}
          accent={isClear ? GREEN : AMBER}
          sub={isClear ? 'All clear' : 'Requires review'}
          delay={0.14}
        />
      </div>

      {toast && (
        <div style={{ marginBottom: 20, padding: '10px 14px', background: T.greenDim, border: `1px solid rgba(34,197,94,0.3)`, borderRadius: 10, color: T.green, fontSize: 13 }}>
          {toast}
        </div>
      )}

      {/* Alerts */}
      <SectionCard
        icon={<Bell size={17} weight="duotone" color={GOLD} />}
        title="Project Alerts"
        subtitle="Issues detected by Autopilot on this project"
        action={<span style={{ fontSize: 12, color: T.muted }}>{activeAlerts.length} active</span>}
        flush
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: T.muted }}>Loading alerts…</div>
        ) : activeAlerts.length === 0 ? (
          <PremiumEmpty
            icon={<CheckCircle size={30} weight="duotone" color={GREEN} />}
            title="No active alerts for this project"
            description="Run a scan to check for new issues."
            action={scanButton}
          />
        ) : (
          <Table
            headers={['Severity', 'Alert Type', 'Message', 'Date', 'Status', 'Actions']}
            rows={activeAlerts.map(a => [
              <Badge key="sev" label={a.severity} color={SEVERITY_BADGE[a.severity] || 'muted'} />,
              <span key="type" style={{ fontWeight: 600 }}>{a.alert_type}</span>,
              <span key="msg" style={{ fontSize: 13 }}>{a.message}</span>,
              <span key="dt" style={{ color: T.muted, whiteSpace: 'nowrap' }}>{a.date ? new Date(a.date).toLocaleDateString() : '---'}</span>,
              <Badge key="st" label={a.status || 'active'} color={a.status === 'resolved' ? 'green' : 'amber'} />,
              <Btn key="act" size="sm" variant="ghost" onClick={() => dismissAlert(a.id)} disabled={dismissingId === a.id}>
                {dismissingId === a.id ? '...' : 'Dismiss'}
              </Btn>,
            ])}
          />
        )}
      </SectionCard>
    </PremiumSurface>
  );
}
