'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { T, Badge, Btn, Table } from '@/components/ui/shell';
import {
  PremiumSurface,
  ModuleHero,
  SectionCard,
  StatCard,
  PremiumEmpty,
  goldButtonStyle,
  ghostButtonStyle,
  goldOutlineButtonStyle,
} from '@/components/ui/premium';
import { SkeletonKPI, SkeletonRow } from '@/components/ui/Skeleton';
import { Question, WarningCircle, Clipboard, FolderOpen, CheckCircle, Clock, Trash, Plus } from '@phosphor-icons/react';
import SaguaroDatePicker from '../../../../../components/SaguaroDatePicker';

interface RFI {
  id: string;
  rfi_number: number;
  subject: string;
  question: string;
  spec_section: string;
  status: string;
  submitted_by: string;
  due_date: string | null;
  answer: string | null;
  answered_by: string | null;
  ball_in_court: string | null;
  assigned_to_name: string | null;
  is_overdue: boolean;
  created_at: string;
}

const STATUS_BADGE: Record<string, 'blue' | 'green' | 'muted' | 'red'> = {
  open: 'blue',
  answered: 'green',
  closed: 'muted',
  overdue: 'red',
};

export default function RFIsPage() {
  const { projectId } = useParams() as { projectId: string };
  const [rfis, setRfis] = useState<RFI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [answeredBy, setAnsweredBy] = useState('');
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');

  // Assign / ball-in-court
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignName, setAssignName] = useState('');
  const [assignDue, setAssignDue] = useState('');
  const [savingAssign, setSavingAssign] = useState(false);

  // Create form
  const [fSubject, setFSubject] = useState('');
  const [fQuestion, setFQuestion] = useState('');
  const [fSpecSection, setFSpecSection] = useState('');
  const [fDueDate, setFDueDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`/api/rfis/list?projectId=${projectId}`);
      if (!r.ok) throw new Error(await r.text());
      const d = await r.json();
      setRfis(d.rfis ?? []);
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to load RFIs');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const totalCount = rfis?.length ?? 0;
  const openCount = rfis?.filter(r => r.status === 'open').length ?? 0;
  const answeredCount = rfis?.filter(r => r.status === 'answered').length ?? 0;
  const overdueCount = rfis?.filter(r => r.is_overdue).length ?? 0;

  function daysOpen(rfi: RFI): number {
    const created = new Date(rfi.created_at || Date.now());
    return Math.max(0, Math.floor((Date.now() - created.getTime()) / 86400000));
  }

  function ballInCourt(rfi: RFI): string {
    return (rfi.ball_in_court || rfi.assigned_to_name || '').trim();
  }

  // Distinct ball-in-court holders for the assignee filter.
  const assigneeOptions = Array.from(
    new Set(rfis.map(ballInCourt).filter(Boolean))
  ).sort();

  const filteredRfis = rfis.filter(rfi => {
    if (statusFilter !== 'all') {
      if (statusFilter === 'overdue') { if (!rfi.is_overdue) return false; }
      else if ((rfi.status || 'open') !== statusFilter) return false;
    }
    if (assigneeFilter !== 'all' && ballInCourt(rfi) !== assigneeFilter) return false;
    return true;
  });

  async function submitRFI() {
    if (!fSubject.trim()) { setError('Subject is required'); return; }
    setSaving(true);
    setError('');
    try {
      const r = await fetch('/api/rfis/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, subject: fSubject, question: fQuestion, specSection: fSpecSection, dueDate: fDueDate || undefined }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setFSubject(''); setFQuestion(''); setFSpecSection(''); setFDueDate('');
      setShowForm(false);
      await load();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to create RFI');
    } finally {
      setSaving(false);
    }
  }

  async function submitAnswer(rfiId: string) {
    if (!answerText.trim()) return;
    setSubmittingAnswer(true);
    try {
      const r = await fetch(`/api/rfis/${rfiId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: answerText, answeredBy, projectId }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setAnsweringId(null);
      setAnswerText('');
      setAnsweredBy('');
      setSuccessMsg('Answer submitted successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
      await load();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to submit answer');
    } finally {
      setSubmittingAnswer(false);
    }
  }

  async function submitAssign(rfiId: string) {
    if (!assignName.trim() && !assignDue) return;
    setSavingAssign(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {};
      if (assignName.trim()) {
        payload.assigned_to_name = assignName.trim();
        payload.ball_in_court = assignName.trim();
        // Re-open if it had been answered/closed and the ball is being moved again.
      }
      if (assignDue) payload.due_date = assignDue;
      const r = await fetch(`/api/rfis/${rfiId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setAssigningId(null);
      setAssignName('');
      setAssignDue('');
      setSuccessMsg('RFI assigned. Ball is now in their court.');
      setTimeout(() => setSuccessMsg(''), 4000);
      await load();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to assign RFI');
    } finally {
      setSavingAssign(false);
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 12px', background: T.surface,
    border: `1px solid ${T.border}`, borderRadius: 8, color: T.white, fontSize: 13, outline: 'none',
  };
  const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 };

  // Disabled-aware CTA helper — keeps goldButtonStyle looking correct while a
  // write is in flight or a required field is empty.
  const disabledGold = (isDisabled: boolean): React.CSSProperties => ({
    ...goldButtonStyle,
    opacity: isDisabled ? 0.5 : 1,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
  });

  return (
    <PremiumSurface maxWidth={1600}>
      {/* Header */}
      <ModuleHero
        eyebrow="Project RFIs"
        eyebrowIcon={<Question size={13} weight="fill" color="#F59E0B" />}
        title="Requests for"
        accent="Information"
        subtitle="Track questions, route the ball-in-court, and close out clarifications before they slow the field."
        actions={
          showForm ? (
            <button onClick={() => setShowForm(false)} style={ghostButtonStyle} className="pmBtn">Cancel</button>
          ) : (
            <button onClick={() => setShowForm(true)} style={goldButtonStyle} className="pmBtn"><Plus size={15} weight="bold" /> Create RFI</button>
          )
        }
      />

      {/* Stat Cards — skeletons while loading, greyed/suppressed on error, real values otherwise */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 22 }}>
        {loading ? (
          <>
            <SkeletonKPI />
            <SkeletonKPI />
            <SkeletonKPI />
            <SkeletonKPI />
          </>
        ) : error ? (
          <div style={{ gridColumn: '1 / -1', opacity: 0.55 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <StatCard icon={<Clipboard size={19} weight="duotone" color={T.faint} />} label="Total RFIs" value="—" />
              <StatCard icon={<FolderOpen size={19} weight="duotone" color={T.faint} />} label="Open" value="—" />
              <StatCard icon={<CheckCircle size={19} weight="duotone" color={T.faint} />} label="Answered" value="—" />
              <StatCard icon={<Clock size={19} weight="duotone" color={T.faint} />} label="Overdue" value="—" />
            </div>
          </div>
        ) : (
          <>
            <StatCard icon={<Clipboard size={19} weight="duotone" color={T.gold} />} label="Total RFIs" value={String(totalCount ?? 0)} delay={0.02} />
            <StatCard icon={<FolderOpen size={19} weight="duotone" color={T.gold} />} label="Open" value={String(openCount ?? 0)} accent={T.gold} delay={0.06} />
            <StatCard icon={<CheckCircle size={19} weight="duotone" color={T.green} />} label="Answered" value={String(answeredCount ?? 0)} accent={T.green} delay={0.10} />
            <StatCard icon={<Clock size={19} weight="duotone" color={overdueCount > 0 ? T.red : T.faint} />} label="Overdue" value={String(overdueCount ?? 0)} accent={overdueCount > 0 ? T.red : undefined} sub={overdueCount > 0 ? 'Needs attention' : undefined} delay={0.14} />
          </>
        )}
      </div>

      {successMsg && (
        <div style={{ margin: '0 0 16px', padding: '10px 14px', background: T.greenDim, border: `1px solid rgba(34,197,94,0.4)`, borderRadius: 10, color: T.green, fontSize: 13 }}>{successMsg}</div>
      )}
      {/* Inline banner for action errors (form/answer) when data is already on screen;
          full-load errors are surfaced by the error block in the table below instead. */}
      {error && !loading && rfis.length > 0 && (
        <div style={{ margin: '0 0 16px', padding: '10px 14px', background: T.redDim, border: `1px solid rgba(239,68,68,0.4)`, borderRadius: 10, color: T.red, fontSize: 13 }}>{error}</div>
      )}

      {/* Create Form */}
      {showForm && (
        <div style={{ marginBottom: 22 }}>
          <SectionCard title="New Request for Information" icon={<Question size={17} weight="duotone" color={T.gold} />}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Subject *</label>
                <input value={fSubject} onChange={e => setFSubject(e.target.value)} placeholder="e.g. Clarify footing depth at grid A-3" style={inp} />
              </div>
              <div>
                <label style={lbl}>Spec Section</label>
                <input value={fSpecSection} onChange={e => setFSpecSection(e.target.value)} placeholder="e.g. 03 30 00" style={inp} />
              </div>
              <div>
                <label style={lbl}>Due Date</label>
                <SaguaroDatePicker value={fDueDate} onChange={setFDueDate} style={inp} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Question / Description</label>
                <textarea value={fQuestion} onChange={e => setFQuestion(e.target.value)} rows={4} placeholder="Describe the question in detail..." style={{ ...inp, resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={submitRFI} disabled={saving || !fSubject.trim()} className="pmBtn" style={disabledGold(saving || !fSubject.trim())}>{saving ? 'Submitting...' : 'Submit RFI'}</button>
              <button onClick={() => { setShowForm(false); setError(''); }} style={ghostButtonStyle} className="pmBtn">Cancel</button>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Filters */}
      {!loading && !error && rfis.length > 0 && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
          <div>
            <label style={lbl}>Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inp, width: 160, cursor: 'pointer' }}>
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="answered">Answered</option>
              <option value="closed">Closed</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Ball in Court</label>
            <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)} style={{ ...inp, width: 200, cursor: 'pointer' }}>
              <option value="all">Anyone</option>
              {assigneeOptions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          {(statusFilter !== 'all' || assigneeFilter !== 'all') && (
            <Btn variant="ghost" size="sm" onClick={() => { setStatusFilter('all'); setAssigneeFilter('all'); }}>Clear filters</Btn>
          )}
          <span style={{ fontSize: 12, color: T.faint, marginLeft: 'auto', paddingBottom: 8 }}>
            {filteredRfis.length} of {rfis.length} shown
          </span>
        </div>
      )}

      {/* Table */}
      <SectionCard title="RFI Log" icon={<Clipboard size={17} weight="duotone" color={T.gold} />} flush>
        {loading ? (
          <div>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : error ? (
          <PremiumEmpty
            tone="error"
            icon={<WarningCircle size={32} weight="duotone" color={T.red} />}
            title="Couldn't load RFIs"
            description={error || 'Something went wrong while loading Requests for Information. Please try again.'}
            action={<button onClick={load} style={goldOutlineButtonStyle} className="pmBtn">Retry</button>}
          />
        ) : rfis.length === 0 ? (
          <PremiumEmpty
            icon={<Question size={32} weight="duotone" color={T.gold} />}
            title="No RFIs yet"
            description="Create your first Request for Information when you need clarification on plans, specs, or project details."
            action={<button onClick={() => setShowForm(true)} style={goldButtonStyle} className="pmBtn"><Plus size={15} weight="bold" /> Create First RFI</button>}
          />
        ) : filteredRfis.length === 0 ? (
          <PremiumEmpty
            icon={<Question size={32} weight="duotone" color={T.gold} />}
            title="No RFIs match these filters"
            description="Try clearing the status or ball-in-court filters to see more."
            action={<button onClick={() => { setStatusFilter('all'); setAssigneeFilter('all'); }} style={goldOutlineButtonStyle} className="pmBtn">Clear filters</button>}
          />
        ) : (
          <>
            <Table
              headers={['RFI #', 'Subject', 'Status', 'Ball in Court', 'Due Date', 'Days Open', 'Actions']}
              rows={filteredRfis.map(rfi => {
                const displayStatus = rfi.is_overdue ? 'overdue' : (rfi.status || 'open');
                const bic = ballInCourt(rfi);
                return [
                  <span key="n" style={{ color: T.gold, fontWeight: 700 }}>#{rfi.rfi_number}</span>,
                  <div key="sub">
                    <div style={{ fontWeight: 600 }}>{rfi.subject}</div>
                    {rfi.question && <div style={{ fontSize: 11, color: T.muted, marginTop: 2, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rfi.question}</div>}
                  </div>,
                  <div key="s" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Badge label={displayStatus} color={STATUS_BADGE[displayStatus] || 'muted'} />
                    {rfi.is_overdue && rfi.status !== 'overdue' && <Badge label="overdue" color="red" />}
                  </div>,
                  <span key="bic" style={{ color: bic ? T.white : T.faint, fontWeight: bic ? 600 : 400 }}>{bic || 'Unassigned'}</span>,
                  <span key="dd" style={{ color: rfi.is_overdue ? T.red : T.muted, fontWeight: rfi.is_overdue ? 700 : 400 }}>
                    {rfi.due_date ? new Date(rfi.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </span>,
                  <span key="do" style={{ color: T.muted }}>{daysOpen(rfi)}d</span>,
                  <div key="act" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {(rfi.status === 'open' || rfi.status === 'pending' || rfi.status === 'draft') && (
                      <Btn size="sm" onClick={() => { setAnsweringId(answeringId === rfi.id ? null : rfi.id); setAnswerText(''); setAnsweredBy(''); setAssigningId(null); }}>
                        {answeringId === rfi.id ? 'Cancel' : 'Answer'}
                      </Btn>
                    )}
                    {rfi.status === 'answered' && <span style={{ fontSize: 11, color: T.green, fontWeight: 700 }}>Answered</span>}
                    <Btn size="sm" variant="ghost" onClick={() => { setAssigningId(assigningId === rfi.id ? null : rfi.id); setAssignName(bic); setAssignDue(rfi.due_date || ''); setAnsweringId(null); }}>
                      {assigningId === rfi.id ? 'Cancel' : 'Assign'}
                    </Btn>
                    <button onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm('Delete this RFI?')) return;
                      setRfis(prev => prev.filter(r => r.id !== rfi.id));
                      try {
                        const res = await fetch(`/api/rfis/${rfi.id}`, { method: 'DELETE' });
                        if (!res.ok) throw new Error('delete failed');
                      } catch { setError('Could not delete the RFI. Please try again.'); load(); }
                    }} style={{background:'none',border:'none',color:'rgba(239,68,68,.5)',cursor:'pointer',fontSize:12,padding:'2px 6px',marginLeft:4}} title="Delete RFI"><Trash size={14} weight="regular" /></button>
                  </div>,
                ];
              })}
            />
            {/* Inline assign / ball-in-court panel */}
            {assigningId && (
              <div style={{ padding: '16px 20px', background: T.surface2, borderTop: `1px solid ${T.border}` }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 10 }}>
                  <div>
                    <label style={lbl}>Ball in Court (assignee)</label>
                    <input value={assignName} onChange={e => setAssignName(e.target.value)} placeholder="e.g. Jane Architect / ACME Design" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Due Date</label>
                    <SaguaroDatePicker value={assignDue} onChange={setAssignDue} style={inp} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => submitAssign(assigningId)} disabled={savingAssign || (!assignName.trim() && !assignDue)} className="pmBtn" style={disabledGold(savingAssign || (!assignName.trim() && !assignDue))}>
                    {savingAssign ? 'Saving...' : 'Save Assignment'}
                  </button>
                  <button onClick={() => { setAssigningId(null); setAssignName(''); setAssignDue(''); }} style={ghostButtonStyle} className="pmBtn">Cancel</button>
                </div>
              </div>
            )}
            {/* Inline answer form */}
            {answeringId && (
              <div style={{ padding: '16px 20px', background: T.surface2, borderTop: `1px solid ${T.border}` }}>
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Answer / Response</label>
                  <textarea value={answerText} onChange={e => setAnswerText(e.target.value)} rows={3} placeholder="Type your answer..." style={{ ...inp, resize: 'vertical' }} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Answered By</label>
                  <input value={answeredBy} onChange={e => setAnsweredBy(e.target.value)} placeholder="Your name" style={inp} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => submitAnswer(answeringId)} disabled={submittingAnswer || !answerText.trim()} className="pmBtn" style={disabledGold(submittingAnswer || !answerText.trim())}>
                    {submittingAnswer ? 'Saving...' : 'Submit Answer'}
                  </button>
                  <button onClick={() => { setAnsweringId(null); setAnswerText(''); setAnsweredBy(''); }} style={ghostButtonStyle} className="pmBtn">Cancel</button>
                </div>
              </div>
            )}
          </>
        )}
      </SectionCard>
    </PremiumSurface>
  );
}
