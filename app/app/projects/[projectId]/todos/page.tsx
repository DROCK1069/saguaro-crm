'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { T, Badge } from '@/components/ui/shell';
import {
  PremiumSurface,
  ModuleHero,
  StatCard,
  SectionCard,
  PremiumEmpty,
  goldButtonStyle,
  ghostButtonStyle,
} from '@/components/ui/premium';
import { Clipboard, Circle, CheckCircle, Warning, Check, Plus } from '@phosphor-icons/react';

interface TodoItem {
  id: string;
  title: string;
  description: string;
  assigned_to: string;
  due_date: string;
  priority: string;
  complete: boolean;
  project_id: string;
}

type FilterTab = 'all' | 'active' | 'completed';

const PRIORITY_BADGE: Record<string, 'red' | 'amber' | 'muted'> = { high: 'red', medium: 'amber', low: 'muted' };
const PRIORITIES = ['high', 'medium', 'low'];

// Desert-dusk accents (match dashboard) ---------------------------------------
const GOLD = '#F59E0B';
const GREEN = '#45B37D';
const RED = '#E0644E';

const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, color: T.white, fontSize: 13, outline: 'none' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 };

// Filter-tab pill styles derived from the kit presets -------------------------
const tabActive: React.CSSProperties = { ...goldButtonStyle, padding: '8px 16px', fontSize: 12.5 };
const tabIdle: React.CSSProperties = { ...ghostButtonStyle, padding: '8px 16px', fontSize: 12.5 };

const EMPTY_FORM = { title: '', description: '', assigned_to: '', due_date: '', priority: 'medium' };

export default function TodosPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');

  const today = new Date().toISOString().split('T')[0];

  const fetchTodos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/todos`);
      const json = await res.json();
      setTodos((json.todos || []).map((t: TodoItem & { status?: string }) => ({ ...t, complete: /complete/i.test(String(t.status || '')) })));
    } catch {
      setTodos([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchTodos(); }, [fetchTodos]);

  const filtered = todos.filter(t => {
    if (filter === 'active') return !t.complete;
    if (filter === 'completed') return t.complete;
    return true;
  });

  const totalCount = todos.length;
  const activeCount = todos.filter(t => !t.complete).length;
  const completedCount = todos.filter(t => t.complete).length;
  const overdueCount = todos.filter(t => t.due_date && t.due_date < today && !t.complete).length;

  async function handleAdd() {
    if (!form.title) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          assigned_to: form.assigned_to,
          due_date: form.due_date || null,
          priority: form.priority,
          status: 'open',
        }),
      });
      if (!res.ok) throw new Error('save failed');
      const json = await res.json();
      if (!json.todo) throw new Error('save failed');
      const t = json.todo as TodoItem & { status?: string };
      setTodos(prev => [{ ...t, complete: /complete/i.test(String(t.status || '')) }, ...prev]);
      setShowForm(false);
      setForm(EMPTY_FORM);
      setToast('Task added.');
      setTimeout(() => setToast(''), 4000);
    } catch {
      setToast('Could not add the task. Please try again.');
      setTimeout(() => setToast(''), 4000);
    } finally {
      setSaving(false);
    }
  }

  async function toggleComplete(id: string) {
    const todo = todos.find(t => t.id === id);
    if (!todo || todo.complete) return;
    setTodos(prev => prev.map(t => t.id === id ? { ...t, complete: true } : t));
    try {
      const res = await fetch(`/api/todos/${id}/complete`, { method: 'PATCH' });
      if (!res.ok) throw new Error('update failed');
    } catch {
      setToast('Could not update the task. Please try again.');
      setTimeout(() => setToast(''), 4000);
      fetchTodos();
    }
  }

  return (
    <PremiumSurface maxWidth={1600}>

      {/* Header */}
      <ModuleHero
        eyebrow="Tasks"
        eyebrowIcon={<Clipboard size={13} weight="fill" color={GOLD} />}
        title="Project"
        accent="To-Dos"
        subtitle="Project tasks and action items."
        actions={
          <button onClick={() => setShowForm(p => !p)} style={goldButtonStyle} className="pmBtn">
            <Plus size={15} weight="bold" /> Add Task
          </button>
        }
      />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard icon={<Clipboard size={19} weight="duotone" color={GOLD} />} label="Total" value={String(totalCount)} sub="all tasks" delay={0.02} />
        <StatCard icon={<Circle size={19} weight="duotone" color={GOLD} />} label="Active" value={String(activeCount)} sub="in progress" accent={activeCount > 0 ? GOLD : undefined} delay={0.06} />
        <StatCard icon={<CheckCircle size={19} weight="duotone" color={GREEN} />} label="Completed" value={String(completedCount)} sub="done" accent={completedCount > 0 ? GREEN : undefined} delay={0.10} />
        <StatCard icon={<Warning size={19} weight="duotone" color={RED} />} label="Overdue" value={String(overdueCount)} sub="past due" accent={overdueCount > 0 ? RED : undefined} delay={0.14} />
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {([['all', 'All'], ['active', 'Active'], ['completed', 'Completed']] as [FilterTab, string][]).map(([key, label]) => (
          <button key={key} className="pmBtn" style={filter === key ? tabActive : tabIdle} onClick={() => setFilter(key)}>{label}</button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.62)', alignSelf: 'center' }}>{filtered.length} task{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {toast && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: T.greenDim, border: `1px solid rgba(34,197,94,0.3)`, borderRadius: 8, color: T.green, fontSize: 13 }}>
          {toast}
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div style={{ marginBottom: 24 }}>
          <SectionCard title="Add Task" icon={<Plus size={16} weight="bold" color={GOLD} />}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={lbl}>Title *</label>
                <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Task description..." style={inp} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={lbl}>Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical' }} />
              </div>
              <div>
                <label style={lbl}>Assigned To</label>
                <input type="text" value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>Due Date</label>
                <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>Priority</label>
                <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} style={inp}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={handleAdd} disabled={saving} className="pmBtn" style={{ ...goldButtonStyle, opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Add Task'}</button>
              <button onClick={() => setShowForm(false)} className="pmBtn" style={ghostButtonStyle}>Cancel</button>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Todo List */}
      <SectionCard title="Task List" icon={<Clipboard size={16} weight="duotone" color={GOLD} />} flush>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.62)' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <PremiumEmpty
            icon={<Clipboard size={30} weight="duotone" color={GOLD} />}
            title="No tasks here"
            description="No tasks in this category yet."
            action={<button onClick={() => setShowForm(true)} style={goldButtonStyle} className="pmBtn"><Plus size={15} weight="bold" /> Add Task</button>}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filtered.map(todo => {
              const overdue = todo.due_date && todo.due_date < today && !todo.complete;
              return (
                <div key={todo.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: `1px solid rgba(255,255,255,0.06)`, opacity: todo.complete ? 0.5 : 1 }}>
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleComplete(todo.id)}
                    style={{
                      width: 22, height: 22, borderRadius: 6,
                      border: `2px solid ${todo.complete ? GREEN : T.border}`,
                      background: todo.complete ? GREEN : 'transparent',
                      cursor: 'pointer', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {todo.complete && <Check size={14} weight="bold" color="#000" />}
                  </button>
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: T.white, fontSize: 14, fontWeight: 500, textDecoration: todo.complete ? 'line-through' : 'none' }}>{todo.title}</div>
                    {todo.description && <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{todo.description}</div>}
                    <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
                      {todo.assigned_to && <span>{todo.assigned_to}</span>}
                    </div>
                  </div>
                  {/* Due date */}
                  <span style={{ fontSize: 12, color: overdue ? RED : T.muted, whiteSpace: 'nowrap' }}>
                    {todo.due_date ? (overdue ? 'Overdue: ' : '') + todo.due_date : '---'}
                  </span>
                  {/* Priority */}
                  <Badge label={todo.priority} color={PRIORITY_BADGE[todo.priority] || 'muted'} />
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </PremiumSurface>
  );
}
