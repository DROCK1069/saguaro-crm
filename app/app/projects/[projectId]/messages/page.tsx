'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { humanError } from '@/lib/errors';
import { useParams } from 'next/navigation';
import { ChatCircleText, ChatsCircle, PaperPlaneTilt } from '@phosphor-icons/react';
import { PremiumSurface, ModuleHero, SectionCard, PremiumEmpty, goldButtonStyle } from '@/components/ui/premium';

// Premium surface palette (matches components/ui/premium.tsx + the dashboard) ----
const GOLD = '#F59E0B';
const WHITE = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.62)';
const FAINT = 'rgba(255,255,255,0.42)';
const BORDER = 'rgba(255,255,255,0.08)';
const RED = '#F87171';
const ME_BG = 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(245,158,11,0.05))';
const ME_BORDER = 'rgba(245,158,11,0.35)';
const OTHER_BG = 'linear-gradient(160deg, rgba(255,255,255,0.055), rgba(255,255,255,0.015))';
const INPUT_BG = 'rgba(255,255,255,0.04)';

interface Message {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
  project_id?: string;
}

// The `messages` table stores sender_name / content / created_at. Normalize the
// raw DB rows into the client shape so the thread actually renders (previously
// the UI read msg.sender/msg.text/msg.timestamp — columns that don't exist —
// so every loaded message showed blank + "Invalid Date").
function normalize(row: Record<string, unknown>): Message {
  return {
    id: String(row.id ?? `${row.created_at ?? ''}-${row.sender_name ?? ''}`),
    sender: String(row.sender_name ?? row.sender ?? 'Team'),
    text: String(row.content ?? row.text ?? ''),
    timestamp: String(row.created_at ?? row.timestamp ?? ''),
    project_id: row.project_id ? String(row.project_id) : undefined,
  };
}

function relativeTime(ts: string): string {
  const then = new Date(ts).getTime();
  if (isNaN(then)) return '';
  const diff = Math.floor((Date.now() - then) / 1000);
  if (diff < 0) return 'just now';
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function MessagesPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [myName, setMyName] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Remember which sender_name is "me" so my own bubbles align right. The server
  // stamps sender_name from my auth identity and returns it on POST; cache it.
  useEffect(() => {
    try { const n = localStorage.getItem('saguaro:msgSender'); if (n) setMyName(n); } catch { /* noop */ }
  }, []);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/messages`);
      const json = await res.json();
      setMessages(Array.isArray(json.messages) ? json.messages.map(normalize) : []);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Poll for new messages every 15 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/messages`);
        const json = await res.json();
        const newMsgs: Message[] = Array.isArray(json.messages) ? json.messages.map(normalize) : [];
        setMessages(prev => {
          if (newMsgs.length !== prev.length) return newMsgs;
          return prev;
        });
      } catch { /* non-fatal */ }
    }, 15000);
    return () => clearInterval(interval);
  }, [projectId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend() {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: body }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.message) throw new Error(json?.error || 'Message failed to send');
      const saved = normalize(json.message);
      // The server just told us our own sender_name — remember it for alignment.
      if (saved.sender) { setMyName(saved.sender); try { localStorage.setItem('saguaro:msgSender', saved.sender); } catch { /* noop */ } }
      setMessages(prev => [...prev, saved]);
      setText('');
    } catch (e: unknown) {
      console.error(e); setError(humanError(e, 'Could not send the message. Please try again.'));
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const sendDisabled = sending || !text.trim();

  return (
    <PremiumSurface maxWidth={1040} pad="40px 28px 40px">
      {/* Header */}
      <ModuleHero
        eyebrow="Communication"
        eyebrowIcon={<ChatCircleText size={13} weight="fill" color={GOLD} />}
        title="Project"
        accent="Messages"
        subtitle="Project team communication — stay in sync with everyone on the job."
      />

      {/* Message thread — full-height card: thread scrolls internally, send bar pinned */}
      <SectionCard
        flush
        icon={<ChatCircleText size={17} weight="duotone" color={GOLD} />}
        title="Team Thread"
        subtitle="Live conversation for this project"
        style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 260px)', minHeight: 460 }}
        bodyStyle={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
      >
        <div
          ref={scrollRef}
          style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: 20 }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: MUTED }}>Loading...</div>
          ) : messages.length === 0 ? (
            <PremiumEmpty
              icon={<ChatsCircle size={30} weight="duotone" color={GOLD} />}
              title="No messages yet"
              description="Start the conversation — send the first message to your project team below."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {messages.map(msg => {
                const isMe = !!myName && msg.sender === myName;
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: isMe ? GOLD : WHITE }}>{msg.sender}</span>
                      <span style={{ fontSize: 11, color: FAINT }}>{relativeTime(msg.timestamp)}</span>
                    </div>
                    <div style={{
                      maxWidth: '70%',
                      padding: '10px 16px',
                      borderRadius: 14,
                      background: isMe ? ME_BG : OTHER_BG,
                      border: `1px solid ${isMe ? ME_BORDER : BORDER}`,
                      color: WHITE,
                      fontSize: 14,
                      lineHeight: 1.5,
                      wordBreak: 'break-word',
                      boxShadow: '0 10px 30px -22px rgba(0,0,0,0.7)',
                    }}>
                      {msg.text}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Send bar */}
        {error && (
          <div style={{ padding: '8px 20px', color: RED, fontSize: 13, borderTop: `1px solid ${BORDER}` }}>{error}</div>
        )}
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            style={{
              flex: 1, padding: '11px 14px',
              background: INPUT_BG, border: `1px solid ${BORDER}`,
              borderRadius: 12, color: WHITE, fontSize: 14, outline: 'none',
            }}
          />
          <button
            onClick={handleSend}
            disabled={sendDisabled}
            className="pmBtn"
            style={{
              ...goldButtonStyle,
              opacity: sendDisabled ? 0.5 : 1,
              cursor: sendDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            <PaperPlaneTilt size={15} weight="fill" />
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </SectionCard>
    </PremiumSurface>
  );
}
