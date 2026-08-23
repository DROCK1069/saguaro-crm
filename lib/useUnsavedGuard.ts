'use client';
/**
 * useUnsavedGuard — reusable unsaved-work protection for form pages.
 *
 * The owner mandate: nothing may let a GC back out of a form page and silently
 * lose their work. This hook provides three layers of protection:
 *
 *   1. HARD EXITS (tab close / refresh / external link): a native
 *      `beforeunload` prompt while the form is dirty.
 *   2. IN-APP NAVIGATION (sidebar / any <a> click): the App Router has no
 *      router events to cancel, so a capture-phase click listener intercepts
 *      internal anchor clicks while dirty and opens the house
 *      Save / Discard / Stay confirm (<UnsavedGuardModal guard={guard} />).
 *   3. DRAFT AUTOSAVE: dirty form data is debounced into localStorage
 *      (`sag_draft:<key>`), flushed synchronously on pagehide/popstate, and
 *      restored with a "Draft restored" toast on return. Cleared on save or
 *      explicit discard. This also covers the browser BACK button, which the
 *      App Router handles before any guard can cancel it — the work is never
 *      lost, it comes back as a draft.
 *
 * Usage:
 *   const guard = useUnsavedGuard({
 *     dirty: isDirty,
 *     draftKey: `invoice:${id}`,          // per route + record
 *     draftData: form,                    // serializable snapshot
 *     restoreDraft: (d) => setForm(d),    // also open the composer if needed
 *     draftEnabled: !loading,             // gate until initial data loaded
 *     onSave: async () => saveForm(),     // return true on success
 *   });
 *   ...
 *   <UnsavedGuardModal guard={guard} />   // from '@/components/UnsavedGuardModal'
 *   ...
 *   guard.clearDraft();                   // after your own successful save
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';

const DRAFT_PREFIX = 'sag_draft:';
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // drafts older than 7 days are dropped
const AUTOSAVE_DEBOUNCE_MS = 800;

export interface UnsavedGuardOptions<T = unknown> {
  /** The page's dirty predicate — guard layers arm only while true. */
  dirty: boolean;
  /** Unique per route + record (e.g. 'invoice-create', `invoice:${id}`). Enables draft autosave. */
  draftKey?: string;
  /** Serializable snapshot of the form; autosaved (debounced) while dirty. */
  draftData?: T;
  /** Called once with the stored draft on return; set your form state (and open the form) here. */
  restoreDraft?: (draft: T) => void;
  /** Gate the one-shot restore until the page's initial data has loaded. Default true. */
  draftEnabled?: boolean;
  /** Save handler for "Save & leave". Return true on success (navigation proceeds). */
  onSave?: () => boolean | Promise<boolean>;
}

export interface UnsavedGuardApi {
  /** True while the Save / Discard / Stay confirm should be shown. */
  confirmOpen: boolean;
  /** Where the user was headed when intercepted. */
  pendingHref: string | null;
  /** True while onSave is running from "Save & leave". */
  saving: boolean;
  /** Whether an onSave handler was provided (modal hides the save button otherwise). */
  canSave: boolean;
  /** Whether draft autosave is active (a draftKey was provided). */
  hasDraft: boolean;
  /** Keep editing — close the confirm, stay on the page. */
  stay: () => void;
  /** Leave without saving — clears the draft and navigates. */
  discard: () => void;
  /** Run onSave; on success clear the draft and navigate. */
  saveAndLeave: () => void;
  /** Flush the draft to this device and navigate — for pages with no direct
   *  save handler (e.g. the estimate workspace). */
  keepDraftAndLeave: () => void;
  /** Clear the stored draft (call after your own successful save). */
  clearDraft: () => void;
  /** Programmatic navigation through the guard (e.g. custom Back buttons). */
  requestLeave: (href: string) => void;
  /** Gate a non-navigation dismissal (Cancel / Close / X buttons) through the
   *  same confirm. Runs the action immediately when clean; on Discard the
   *  draft is cleared first (Cancel means cancel). */
  requestClose: (action: () => void) => void;
}

function draftStorageKey(key: string): string {
  return DRAFT_PREFIX + key;
}

function readDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(draftStorageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { t?: number; data?: T };
    if (!parsed || typeof parsed.t !== 'number' || parsed.data === undefined) return null;
    if (Date.now() - parsed.t > DRAFT_TTL_MS) {
      localStorage.removeItem(draftStorageKey(key));
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeDraft(key: string, data: unknown): void {
  try {
    localStorage.setItem(draftStorageKey(key), JSON.stringify({ t: Date.now(), data }));
  } catch {
    /* storage full / unavailable — best-effort */
  }
}

function removeDraft(key: string): void {
  try {
    localStorage.removeItem(draftStorageKey(key));
  } catch {
    /* ignore */
  }
}

export function useUnsavedGuard<T = unknown>(opts: UnsavedGuardOptions<T>): UnsavedGuardApi {
  const { dirty, draftKey, draftData, restoreDraft, draftEnabled = true, onSave } = opts;
  const router = useRouter();
  const { showToast } = useToast();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Latest values in refs so document-level listeners never go stale.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const draftDataRef = useRef(draftData);
  draftDataRef.current = draftData;
  const confirmOpenRef = useRef(confirmOpen);
  confirmOpenRef.current = confirmOpen;
  const restoredRef = useRef(false);

  /* ── Layer 1: hard exits (close tab / refresh / external nav) ─────────── */
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      // Flush the draft first — even if they leave anyway, the work survives.
      if (draftKey && draftDataRef.current !== undefined) writeDraft(draftKey, draftDataRef.current);
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, draftKey]);

  /* ── Layer 2: in-app link clicks (sidebar, breadcrumbs, any <a>) ──────── */
  useEffect(() => {
    if (!dirty) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (confirmOpenRef.current) return;
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const rawHref = anchor.getAttribute('href') || '';
      if (!rawHref || rawHref.startsWith('#')) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      let url: URL;
      try {
        url = new URL(rawHref, window.location.href);
      } catch {
        return;
      }
      // External destinations fall through to the beforeunload prompt.
      if (url.origin !== window.location.origin) return;
      // Same-page (query/hash only) moves are not "leaving".
      if (url.pathname === window.location.pathname) return;
      // Capture phase on document runs before React's delegated handlers, so
      // stopPropagation reliably blocks Next.js <Link> client navigation.
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(url.pathname + url.search + url.hash);
      setConfirmOpen(true);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [dirty]);

  /* ── Layer 3a: browser back / pagehide — synchronous draft flush ──────── */
  // The App Router processes popstate before a guard can cancel it, so the
  // back button can't show the modal — instead the draft is flushed the
  // instant it fires, and the work comes back via "Draft restored" on return.
  useEffect(() => {
    if (!draftKey) return;
    const flush = () => {
      if (dirtyRef.current && draftDataRef.current !== undefined) writeDraft(draftKey, draftDataRef.current);
    };
    window.addEventListener('popstate', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('popstate', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, [draftKey]);

  /* ── Layer 3b: debounced draft autosave while dirty ───────────────────── */
  useEffect(() => {
    if (!draftKey || !dirty || !draftEnabled || draftData === undefined) return;
    const t = setTimeout(() => writeDraft(draftKey, draftData), AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [draftKey, dirty, draftEnabled, draftData]);

  /* ── Layer 3c: one-shot draft restore on return ───────────────────────── */
  useEffect(() => {
    if (!draftKey || !draftEnabled || restoredRef.current || !restoreDraft) return;
    restoredRef.current = true;
    const stored = readDraft<T>(draftKey);
    if (stored === null) return;
    try {
      restoreDraft(stored);
      showToast('Draft restored — your unsaved work was recovered.', 'info');
    } catch {
      /* corrupt draft — drop it rather than crash the form */
      removeDraft(draftKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, draftEnabled]);

  /* ── Modal actions ────────────────────────────────────────────────────── */
  // A pending non-navigation dismissal (Cancel / Close button) intercepted
  // while dirty; runs on Discard / after a successful Save instead of a push.
  const pendingActionRef = useRef<(() => void) | null>(null);

  const stay = useCallback(() => {
    setConfirmOpen(false);
    setPendingHref(null);
    pendingActionRef.current = null;
  }, []);

  const clearDraft = useCallback(() => {
    if (draftKey) removeDraft(draftKey);
  }, [draftKey]);

  const proceed = useCallback((href: string | null) => {
    setConfirmOpen(false);
    setPendingHref(null);
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    if (action) action();
    else if (href) router.push(href);
  }, [router]);

  const discard = useCallback(() => {
    if (draftKey) removeDraft(draftKey);
    proceed(pendingHref);
  }, [draftKey, pendingHref, proceed]);

  const saveAndLeave = useCallback(async () => {
    if (!onSave || saving) return;
    setSaving(true);
    try {
      const ok = await onSave();
      if (ok) {
        if (draftKey) removeDraft(draftKey);
        proceed(pendingHref);
      }
      // On failure: stay open — the page surfaces its own error state.
    } finally {
      setSaving(false);
    }
  }, [onSave, saving, draftKey, pendingHref, proceed]);

  const keepDraftAndLeave = useCallback(() => {
    if (draftKey && draftDataRef.current !== undefined) writeDraft(draftKey, draftDataRef.current);
    proceed(pendingHref);
  }, [draftKey, pendingHref, proceed]);

  const requestLeave = useCallback((href: string) => {
    if (!dirtyRef.current) {
      router.push(href);
      return;
    }
    pendingActionRef.current = null;
    setPendingHref(href);
    setConfirmOpen(true);
  }, [router]);

  const requestClose = useCallback((action: () => void) => {
    if (!dirtyRef.current) {
      action();
      return;
    }
    pendingActionRef.current = action;
    setPendingHref(null);
    setConfirmOpen(true);
  }, []);

  return {
    confirmOpen,
    pendingHref,
    saving,
    canSave: !!onSave,
    hasDraft: !!draftKey,
    stay,
    discard,
    saveAndLeave,
    keepDraftAndLeave,
    clearDraft,
    requestLeave,
    requestClose,
  };
}
