'use client';
/**
 * Drag-drop + click file uploader. Streams to /api/files/upload (cookie auth),
 * which stores a project_files row and returns signed rows. Reusable across the
 * platform (project files, fleet, RFIs…). Calls onUploaded with the new rows.
 */
import React, { useCallback, useRef, useState } from 'react';
import { UploadSimple, Spinner } from '@phosphor-icons/react';

export function FileDropzone({
  projectId, folder, category, entityType, entityId, onUploaded, compact,
}: {
  projectId?: string | null; folder?: string | null; category?: string | null;
  entityType?: string | null; entityId?: string | null;
  onUploaded?: (rows: any[]) => void; compact?: boolean; // eslint-disable-line @typescript-eslint/no-explicit-any
}) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(async (list: FileList | File[]) => {
    const files = Array.from(list);
    if (!files.length) return;
    setBusy(true); setMsg(`Uploading ${files.length} file${files.length > 1 ? 's' : ''}…`);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('file', f));
      if (projectId) fd.append('projectId', projectId);
      if (folder) fd.append('folder', folder);
      if (category) fd.append('category', category);
      if (entityType) fd.append('entityType', entityType);
      if (entityId) fd.append('entityId', entityId);
      const res = await fetch('/api/files/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const rows = json.files || [];
      const failed = json.failed || [];
      setMsg(failed.length ? `${rows.length} uploaded, ${failed.length} failed` : `${rows.length} uploaded`);
      onUploaded?.(rows);
    } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      setMsg(e?.message || 'Upload failed');
    }
    setBusy(false);
    setTimeout(() => setMsg(''), 3500);
  }, [projectId, folder, category, entityType, entityId, onUploaded]);

  return (
    <div>
      <label
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files?.length) upload(e.dataTransfer.files); }}
        style={{
          display: 'flex', flexDirection: compact ? 'row' : 'column', alignItems: 'center', justifyContent: 'center',
          gap: 10, padding: compact ? '12px 16px' : '26px 20px', cursor: busy ? 'wait' : 'pointer',
          border: `1.5px dashed ${over ? '#F59E0B' : 'rgba(255,255,255,0.18)'}`, borderRadius: 12,
          background: over ? 'rgba(245,158,11,0.08)' : '#141416', transition: 'all .12s', textAlign: 'center',
        }}
      >
        {busy ? <Spinner size={compact ? 18 : 26} color="#F59E0B" className="spin" /> : <UploadSimple size={compact ? 18 : 26} color={over ? '#F59E0B' : '#CBD5E1'} />}
        <div style={{ color: '#CBD5E1', fontSize: compact ? 13 : 14 }}>
          <b style={{ color: '#fff' }}>{busy ? msg || 'Uploading…' : 'Drop files or click to upload'}</b>
          {!compact && !busy && <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Images, video, PDF, Office, CAD — up to 500MB each</div>}
        </div>
        <input ref={inputRef} type="file" multiple style={{ display: 'none' }} disabled={busy}
          onChange={(e) => { if (e.target.files?.length) upload(e.target.files); e.currentTarget.value = ''; }} />
      </label>
      {msg && !busy && <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 6 }}>{msg}</div>}
      <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
