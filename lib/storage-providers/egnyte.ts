/**
 * Egnyte storage adapter (token-based auth) — very common in AEC firms.
 *
 * Auth style: a single per-tenant API bearer token (no OAuth refresh dance).
 *   ctx.config.domain   — the Egnyte domain, e.g. "acme.egnyte.com"
 *   ctx.secret.apiToken — the Egnyte API access token (sent as Authorization: Bearer <token>)
 *   ctx.rootPath        — optional starting folder (defaults to "/Shared")
 *
 * API surface (Egnyte Public API v1, base https://{domain}/pubapi/v1):
 *   GET  /userinfo                    — identity check (test)
 *   GET  /fs{path}                    — list a folder → { folders[], files[] }
 *   GET  /fs-content{path}            — download a file's raw bytes
 *   POST /fs-content{path}            — upload raw bytes to path
 *   DELETE /fs{path}                  — delete a file/folder
 *   POST /fs{path} {action:"link"}    — create a shareable link (optional)
 *
 * "path" locators are the raw Egnyte filesystem path (e.g. "/Shared/Projects/Bid.pdf").
 * We STORE the raw path on items and URL-encode each segment only when building request URLs.
 */
import type { StorageProvider, StorageItem, ListResult, ConnectorCtx } from './types';
import { apiFetch } from './types';
import crypto from 'crypto';

const DEFAULT_ROOT = '/Shared';
const EGNYTE_SINGLE_LIMIT = 90 * 1024 * 1024;  // single-POST ceiling; larger → chunked
const EGNYTE_CHUNK = 50 * 1024 * 1024;         // 50MB per chunk (>= Egnyte's 10MB minimum)

/** Encode a filesystem path segment-by-segment (preserve the "/" separators). */
function encodePath(p: string): string {
  const normalized = '/' + p.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  return normalized === '/' ? '/' : normalized;
}

/** Normalize any incoming path to a leading-slash raw path (no trailing slash except root). */
function normPath(p?: string | null): string {
  const raw = (p && p.trim()) || '';
  if (!raw) return '';
  const cleaned = '/' + raw.split('/').filter(Boolean).join('/');
  return cleaned;
}

/** Parent folder of a raw Egnyte path (null at/above root). */
function parentOf(p: string): string | null {
  const parts = p.split('/').filter(Boolean);
  if (parts.length <= 1) return null; // parent of "/Shared" or "/x" is the (implicit) root
  return '/' + parts.slice(0, -1).join('/');
}

export function make(ctx: ConnectorCtx): StorageProvider {
  const domain = String(ctx.config?.domain || '').replace(/^https?:\/\//, '').replace(/\/+$/, '').trim();
  const apiToken = String(ctx.secret?.apiToken || '').trim();
  const base = `https://${domain}/pubapi/v1`;

  if (!domain) throw new Error('Egnyte: missing config.domain (e.g. "acme.egnyte.com")');
  if (!apiToken) throw new Error('Egnyte: missing secret.apiToken');

  const authHeaders = (): Record<string, string> => ({ Authorization: `Bearer ${apiToken}` });

  const rootPath = normPath(ctx.rootPath) || DEFAULT_ROOT;

  return {
    provider: 'egnyte',

    async test() {
      try {
        const info = await apiFetch(`${base}/userinfo`, { headers: authHeaders() });
        const account = info?.username || info?.email || info?.first_name || domain;
        return { ok: true, account: String(account) };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },

    async list(path?: string | null): Promise<ListResult> {
      const target = normPath(path) || rootPath;
      const items: StorageItem[] = [];
      const PAGE = 1000;
      let offset = 0;
      // Egnyte pages large folders (count/offset + total_count) — loop or big
      // folders silently truncate. Guard with a hard cap so a bad total can't spin.
      for (let guard = 0; guard < 1000; guard++) {
        let data: any; // eslint-disable-line @typescript-eslint/no-explicit-any
        try {
          data = await apiFetch(`${base}/fs${encodePath(target)}?list_content=true&count=${PAGE}&offset=${offset}`, { headers: authHeaders() });
        } catch (e) {
          throw new Error(`Egnyte list failed for "${target}": ${e instanceof Error ? e.message : String(e)}`);
        }
        const folders = Array.isArray(data?.folders) ? data.folders : [];
        const files = Array.isArray(data?.files) ? data.files : [];
        for (const f of folders) {
          const fpath = normPath(f?.path) || `${target}/${f?.name}`.replace(/\/+/g, '/');
          items.push({ name: String(f?.name ?? fpath.split('/').pop() ?? ''), path: fpath, kind: 'folder', externalId: f?.folder_id != null ? String(f.folder_id) : null, modified: f?.last_modified != null ? String(f.last_modified) : null });
        }
        for (const f of files) {
          const fpath = normPath(f?.path) || `${target}/${f?.name}`.replace(/\/+/g, '/');
          items.push({ name: String(f?.name ?? fpath.split('/').pop() ?? ''), path: fpath, kind: 'file', size: f?.size != null ? Number(f.size) : null, modified: f?.last_modified != null ? String(f.last_modified) : null, externalId: f?.entry_id != null ? String(f.entry_id) : null });
        }
        const total = Number(data?.total_count);
        offset += folders.length + files.length;
        if (folders.length + files.length === 0) break;             // no more
        if (Number.isFinite(total) && offset >= total) break;       // fetched all
      }
      return { items, path: target, parent: parentOf(target) };
    },

    async download(path: string) {
      const target = normPath(path);
      if (!target) throw new Error('Egnyte download: empty path');
      let res: Response;
      try {
        res = await apiFetch(`${base}/fs-content${encodePath(target)}`, { headers: authHeaders(), raw: true });
      } catch (e) {
        throw new Error(`Egnyte download failed for "${target}": ${e instanceof Error ? e.message : String(e)}`);
      }
      const ab = await res.arrayBuffer();
      const bytes = Buffer.from(ab);
      const mime = res.headers.get('content-type');
      return { bytes, name: target.split('/').pop() || target, mime };
    },

    async upload(destFolder: string | null, name: string, bytes: Buffer, mime?: string | null) {
      const folder = normPath(destFolder) || rootPath;
      const full = normPath(`${folder}/${name}`);
      const contentType = mime || 'application/octet-stream';

      // Small files: one POST. Large files: Egnyte chunked upload (each chunk carries
      // a SHA-512; chunk 1 returns an upload-id; the final chunk sets Last-Chunk).
      if (bytes.length <= EGNYTE_SINGLE_LIMIT) {
        try {
          await apiFetch(`${base}/fs-content${encodePath(full)}`, {
            method: 'POST', headers: { ...authHeaders(), 'Content-Type': contentType },
            body: new Uint8Array(bytes), raw: true,
          });
        } catch (e) {
          throw new Error(`Egnyte upload failed for "${full}": ${e instanceof Error ? e.message : String(e)}`);
        }
        return { path: full };
      }

      const url = `${base}/fs-content-chunked${encodePath(full)}`;
      const total = bytes.length;
      let uploadId: string | null = null;
      let num = 0;
      try {
        for (let start = 0; start < total; start += EGNYTE_CHUNK) {
          num++;
          const end = Math.min(start + EGNYTE_CHUNK, total);
          const chunk = bytes.subarray(start, end);
          const sha512 = crypto.createHash('sha512').update(chunk).digest('hex');
          const headers: Record<string, string> = {
            ...authHeaders(), 'Content-Type': contentType,
            'X-Egnyte-Chunk-Num': String(num), 'X-Egnyte-Chunk-Sha512-Checksum': sha512,
          };
          if (uploadId) headers['X-Egnyte-Upload-Id'] = uploadId;
          if (end >= total) headers['X-Egnyte-Last-Chunk'] = 'true';
          const res: Response = await apiFetch(url, { method: 'POST', headers, body: new Uint8Array(chunk), raw: true });
          if (num === 1) {
            uploadId = res.headers.get('X-Egnyte-Upload-Id') || res.headers.get('x-egnyte-upload-id');
            if (!uploadId) throw new Error('no upload id returned from chunk 1');
          }
        }
      } catch (e) {
        throw new Error(`Egnyte chunked upload failed for "${full}": ${e instanceof Error ? e.message : String(e)}`);
      }
      return { path: full };
    },

    async remove(path: string) {
      const target = normPath(path);
      if (!target) throw new Error('Egnyte remove: empty path');
      try {
        await apiFetch(`${base}/fs${encodePath(target)}`, { method: 'DELETE', headers: authHeaders(), raw: true });
      } catch (e) {
        throw new Error(`Egnyte delete failed for "${target}": ${e instanceof Error ? e.message : String(e)}`);
      }
    },

    async link(path: string): Promise<string | null> {
      const target = normPath(path);
      if (!target) return null;
      try {
        const resp = await apiFetch(`${base}/links`, {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: target,
            type: 'file',
            accessibility: 'anyone',
            send_email: false,
          }),
        });
        const links = Array.isArray(resp?.links) ? resp.links : [];
        const url = links[0]?.url || resp?.url || null;
        return url ? String(url) : null;
      } catch {
        return null;
      }
    },
  };
}
