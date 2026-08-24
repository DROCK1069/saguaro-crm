'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getQueueCount,
  getDeadLetterCount,
  replayQueue,
} from '@/lib/field-db';

/**
 * Offline queue indicator for the field pages.
 *
 * This used to read `lib/offline-sync.ts`, which owns a SEPARATE IndexedDB
 * database ('saguaro-offline' / 'sync_queue') that nothing in the app ever
 * writes to. Every field page — photos included — enqueues into
 * `lib/field-db.ts` ('saguaro-field' / 'queue'). So the bar reported "0 pending"
 * over a queue holding real unsent photos, and its Sync Now button drained a
 * store that was empty by construction. It now reads and replays the queue the
 * app actually fills, including the dead-letter store, which is where a photo
 * ends up after five failed attempts and which the crew must be told about.
 */
const GOLD = '#F59E0B';
const RAISED = '#141416';
const BORDER = 'rgba(255,255,255,0.12)';
const DIM = '#CBD5E1';
const TEXT = '#FFFFFF';
const RED = '#EF4444';

export default function OfflineSyncStatus() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [dead, setDead] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<{ synced: number; failed: number; dead: number } | null>(null);
  const [storeError, setStoreError] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      const [q, d] = await Promise.all([getQueueCount(), getDeadLetterCount()]);
      setPending(q);
      setDead(d);
      setStoreError(false);
    } catch {
      // IndexedDB unavailable (private mode, SSR hydration edge). "0 pending"
      // would be a claim we cannot support — flag it instead.
      setStoreError(true);
    }
  }, []);

  useEffect(() => {
    setOnline(typeof navigator === 'undefined' ? true : navigator.onLine);
    refreshCount();

    const interval = setInterval(refreshCount, 10000);

    const handleOnline = () => { setOnline(true); refreshCount(); };
    const handleOffline = () => { setOnline(false); };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshCount]);

  useEffect(() => {
    if (lastResult) {
      const timer = setTimeout(() => setLastResult(null), 6000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [lastResult]);

  const handleSync = async () => {
    if (syncing || !online) return;
    setSyncing(true);
    setLastResult(null);
    try {
      // replayQueue honours per-item exponential backoff; `skipped` items are
      // still pending, so they stay in the count rather than being called synced.
      const result = await replayQueue();
      setLastResult({ synced: result.success, failed: result.failed + result.skipped, dead: result.dead });
    } catch {
      setLastResult({ synced: 0, failed: pending, dead: 0 });
    } finally {
      await refreshCount();
      setSyncing(false);
    }
  };

  const showBar = !online || pending > 0 || dead > 0 || syncing || !!lastResult || storeError;
  if (!showBar) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 72,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: RAISED,
        border: `1px solid ${dead > 0 ? RED : BORDER}`,
        borderRadius: 12,
        padding: '8px 14px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 13,
        color: TEXT,
        animation: 'syncSlideUp 0.3s ease-out',
        maxWidth: 'calc(100vw - 32px)',
        flexWrap: 'wrap',
      }}
    >
      <style>{`
        @keyframes syncSlideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes syncPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {/* Status dot */}
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: online ? '#22c55e' : RED,
          boxShadow: online ? '0 0 6px #22c55e' : `0 0 6px ${RED}`,
          flexShrink: 0,
          animation: syncing ? 'syncPulse 1s ease-in-out infinite' : undefined,
        }}
      />

      {/* Status text */}
      <span style={{ color: online ? '#22c55e' : RED, fontWeight: 600, fontSize: 12 }}>
        {syncing ? 'Syncing...' : online ? 'Online' : 'Offline'}
      </span>

      {/* The queue could not be read — say that rather than implying it is empty. */}
      {storeError && (
        <span style={{ fontSize: 11, color: GOLD }}>queue unreadable</span>
      )}

      {/* Pending badge */}
      {!storeError && pending > 0 && !syncing && (
        <span
          style={{
            background: online ? GOLD : RED,
            color: '#1C1C1E',
            fontSize: 11,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 10,
          }}
        >
          {pending} pending
        </span>
      )}

      {/* Dead-letter badge — these have exhausted their retries and will NOT
          sync on their own. Hiding them is how a day of photos disappears. */}
      {!storeError && dead > 0 && (
        <span
          style={{
            background: RED,
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 10,
          }}
          title="These uploads failed five times and were parked. They will not retry on their own."
        >
          {dead} stuck
        </span>
      )}

      {/* Sync result */}
      {lastResult && (
        <span style={{ fontSize: 11, color: lastResult.failed > 0 || lastResult.dead > 0 ? GOLD : '#22c55e' }}>
          {lastResult.synced} synced
          {lastResult.failed > 0 ? `, ${lastResult.failed} still pending` : ''}
          {lastResult.dead > 0 ? `, ${lastResult.dead} gave up` : ''}
        </span>
      )}

      {/* Sync Now button */}
      {online && pending > 0 && !syncing && (
        <button
          onClick={handleSync}
          style={{
            background: GOLD,
            color: '#1C1C1E',
            border: 'none',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Sync Now
        </button>
      )}

      {/* Offline, with work waiting: no button can help — say what happens next. */}
      {!online && pending > 0 && (
        <span style={{ fontSize: 11, color: DIM }}>will send when back online</span>
      )}
    </div>
  );
}
