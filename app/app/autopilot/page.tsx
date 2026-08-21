'use client';
import React, { useState, useEffect } from 'react';
import { ArrowsClockwise, Robot, CheckCircle, Bell, WarningOctagon, Warning } from '@phosphor-icons/react';
import { PremiumSurface, ModuleHero, StatCard, SectionCard, PremiumEmpty, goldButtonStyle } from '@/components/ui/premium';

const GOLD='#F59E0B',DARK='#0a0a0a',RAISED='#141416',BORDER='rgba(255,255,255,0.12)',DIM='#CBD5E1',TEXT='#FFFFFF',RED='#c03030';

type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';

interface AutopilotAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  summary: string;
  rule_code: string;
  entity_type: string;
  acknowledged?: boolean;
  dismissed?: boolean;
}

export default function AutopilotPage() {
  const [filter, setFilter] = useState<'all'|'critical'|'high'|'medium'>('all');
  const [feedback, setFeedback] = useState<string>('');
  const [alertStates, setAlertStates] = useState<Record<string, 'acknowledged'|'dismissed'>>({});
  const [scanning, setScanning] = useState(false);
  const [allAlerts, setAllAlerts] = useState<AutopilotAlert[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadAlerts() {
      try {
        const r = await fetch('/api/autopilot/alerts');
        if (!r.ok) return;
        const data = await r.json();
        if (cancelled) return;
        const rows = Array.isArray(data.alerts) ? data.alerts : [];
        setAllAlerts(rows.map((a: any): AutopilotAlert => ({
          id: a.id,
          severity: (a.severity || 'medium') as AlertSeverity,
          title: a.title || '',
          summary: a.summary || a.body || '',
          rule_code: a.rule_code || '',
          entity_type: a.entity_type || '',
        })));
      } catch { /* non-critical */ }
    }
    loadAlerts();
    return () => { cancelled = true; };
  }, []);

  const visibleAlerts = allAlerts.filter(a => {
    if (alertStates[a.id] === 'dismissed') return false;
    return filter === 'all' || a.severity === filter;
  });

  const sevColor = (s: string) => s==='critical'?{bg:'rgba(192,48,48,.12)',c:'#ff7070',border:'rgba(192,48,48,.3)'}:s==='high'?{bg:'rgba(249,115,22,.1)',c:'#f97316',border:'rgba(249,115,22,.3)'}:{bg:'rgba(245, 158, 11,.1)',c:GOLD,border:'rgba(245, 158, 11,.3)'};

  async function acknowledge(alertId: string) {
    setAlertStates(prev => ({ ...prev, [alertId]: 'acknowledged' }));
    try {
      await fetch('/api/autopilot/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, action: 'acknowledge' }),
      });
    } catch { /* non-critical */ }
    showFeedback('Alert acknowledged.');
  }

  async function dismiss(alertId: string) {
    setAlertStates(prev => ({ ...prev, [alertId]: 'dismissed' }));
    try {
      await fetch('/api/autopilot/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, action: 'dismiss' }),
      });
    } catch { /* non-critical */ }
    showFeedback('Alert dismissed.');
  }

  async function runScan() {
    setScanning(true);
    try {
      // Tenant is derived server-side from the authenticated session — never
      // sent from the client. (The route ignores any body tenantId.)
      const r = await fetch('/api/autopilot/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await r.json();
      showFeedback(data.summary || 'Autopilot scan complete!');
    } catch {
      showFeedback('Autopilot scan triggered!');
    }
    setScanning(false);
  }

  function showFeedback(msg: string) {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 4000);
  }

  const acknowledgedCount = Object.values(alertStates).filter(v => v === 'acknowledged').length;

  const filterTabs = (
    <div style={{display:'flex',gap:8,flexWrap:'wrap' as const}}>
      {(['all','critical','high','medium'] as const).map(f=>(
        <button key={f} onClick={()=>setFilter(f)} className="pmBtn" style={{padding:'6px 16px',borderRadius:8,border:`1px solid ${filter===f?'var(--brand-primary-35)':BORDER}`,background:filter===f?'var(--brand-primary-12)':'rgba(255,255,255,0.03)',color:filter===f?'var(--brand-primary-strong)':DIM,fontSize:13,fontWeight:700,cursor:'pointer',textTransform:'capitalize' as const}}>
          {f==='all'?`All (${allAlerts.filter(a=>alertStates[a.id]!=='dismissed').length})`:f}
        </button>
      ))}
    </div>
  );

  return (
    <PremiumSurface maxWidth={1600}>

      {/* Header */}
      <ModuleHero
        eyebrow="AI Monitoring"
        eyebrowIcon={<Robot size={13} weight="fill" color="#F59E0B" />}
        title="Autopilot"
        accent="Dashboard"
        subtitle="Auto-scans every 6 hours (and on demand) — overdue RFIs & invoices, expiring insurance, pending lien waivers, stale change orders, budget overruns & scope-creep velocity."
        actions={
          <button
            onClick={runScan}
            disabled={scanning}
            className="pmBtn"
            style={{...goldButtonStyle, opacity: scanning ? 0.65 : 1, cursor: scanning ? 'not-allowed' : 'pointer'}}
          >
            {scanning ? (
              <><ArrowsClockwise size={16} weight="bold" color="#1A1206" /> Scanning...</>
            ) : (
              <><Robot size={16} weight="fill" color="#1A1206" /> Run Scan Now</>
            )}
          </button>
        }
      />

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))',gap:12,marginBottom:28}}>
        <StatCard
          icon={<Bell size={19} weight="duotone" color={GOLD} />}
          label="Total Alerts" value={allAlerts.length.toString()}
          sub="across all rules" delay={0.02}
        />
        <StatCard
          icon={<WarningOctagon size={19} weight="duotone" color="#ff7070" />}
          label="Critical" value={allAlerts.filter(a=>a.severity==='critical').length.toString()}
          accent={allAlerts.some(a=>a.severity==='critical') ? '#ff7070' : undefined}
          sub="need immediate action" delay={0.06}
        />
        <StatCard
          icon={<Warning size={19} weight="duotone" color="#f97316" />}
          label="High" value={allAlerts.filter(a=>a.severity==='high').length.toString()}
          accent={allAlerts.some(a=>a.severity==='high') ? '#f97316' : undefined}
          sub="review soon" delay={0.10}
        />
        <StatCard
          icon={<CheckCircle size={19} weight="duotone" color="#3dd68c" />}
          label="Acknowledged" value={acknowledgedCount.toString()}
          accent={acknowledgedCount > 0 ? '#3dd68c' : undefined}
          sub="handled this session" delay={0.14}
        />
      </div>

      {/* Alerts */}
      <SectionCard
        icon={<Robot size={17} weight="duotone" color={GOLD} />}
        title="Autopilot Alerts"
        subtitle="Issues detected across your projects"
        action={filterTabs}
        flush
      >
        <div style={{padding:20,display:'flex',flexDirection:'column',gap:12}}>
          {visibleAlerts.map(alert=>{
            const sc = sevColor(alert.severity);
            const isAcknowledged = alertStates[alert.id] === 'acknowledged';
            return (
              <div key={alert.id} style={{background:isAcknowledged?'rgba(61,214,140,.05)':'rgba(255,255,255,0.03)',border:`1px solid ${isAcknowledged?'rgba(61,214,140,.22)':sc.border}`,borderRadius:14,padding:20,opacity:isAcknowledged?0.72:1,transition:'all .2s'}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:14}}>
                  <div style={{padding:'4px 10px',borderRadius:6,background:isAcknowledged?'rgba(61,214,140,.15)':sc.bg,color:isAcknowledged?'#3dd68c':sc.c,fontSize:10,fontWeight:800,textTransform:'uppercase' as const,border:`1px solid ${isAcknowledged?'rgba(61,214,140,.3)':sc.border}`,flexShrink:0,marginTop:2}}>
                    {isAcknowledged ? 'ACK' : alert.severity}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:800,color:TEXT,fontSize:15,marginBottom:5}}>{alert.title}</div>
                    <div style={{fontSize:13,color:'rgba(255,255,255,0.62)',lineHeight:1.6,marginBottom:12}}>{alert.summary}</div>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap' as const}}>
                      <span style={{fontSize:11,padding:'2px 8px',borderRadius:5,background:'rgba(255,255,255,0.05)',color:'rgba(255,255,255,0.55)'}}>{alert.rule_code.replace(/_/g,' ')}</span>
                      <span style={{fontSize:11,padding:'2px 8px',borderRadius:5,background:'rgba(255,255,255,0.05)',color:'rgba(255,255,255,0.55)'}}>{alert.entity_type}</span>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:8,flexShrink:0}}>
                    {!isAcknowledged && (
                      <button
                        onClick={() => acknowledge(alert.id)}
                        className="pmBtn"
                        style={{padding:'6px 12px',background:'rgba(61,214,140,.1)',border:'1px solid rgba(61,214,140,.3)',borderRadius:8,color:'#3dd68c',fontSize:12,fontWeight:700,cursor:'pointer'}}
                      >
                        Acknowledge
                      </button>
                    )}
                    <button
                      onClick={() => dismiss(alert.id)}
                      className="pmBtn"
                      style={{padding:'6px 12px',background:'rgba(255,255,255,0.04)',border:`1px solid ${BORDER}`,borderRadius:8,color:DIM,fontSize:12,cursor:'pointer'}}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {visibleAlerts.length===0&&(
            <PremiumEmpty
              icon={<CheckCircle size={38} weight="duotone" color="#3dd68c" />}
              title="No autopilot alerts — all clear!"
              description="All projects are running smoothly. Run a scan to check for new issues."
              action={
                <button
                  onClick={runScan}
                  disabled={scanning}
                  className="pmBtn"
                  style={{...goldButtonStyle, opacity: scanning ? 0.65 : 1, cursor: scanning ? 'not-allowed' : 'pointer'}}
                >
                  {scanning ? (
                    <><ArrowsClockwise size={16} weight="bold" color="#1A1206" /> Scanning...</>
                  ) : (
                    <><Robot size={16} weight="fill" color="#1A1206" /> Run Scan Now</>
                  )}
                </button>
              }
            />
          )}
        </div>
      </SectionCard>

      {feedback && (
        <div style={{position:'fixed',bottom:'24px',left:'50%',transform:'translateX(-50%)',zIndex:99999,padding:'12px 20px',borderRadius:'10px',background:'rgba(34,197,94,0.92)',color:'#fff',fontWeight:600,fontSize:'14px',whiteSpace:'nowrap',boxShadow:'0 12px 30px -12px rgba(0,0,0,0.6)'}}>
          {feedback}
        </div>
      )}
    </PremiumSurface>
  );
}
