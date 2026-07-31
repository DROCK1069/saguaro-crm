/**
 * Box storage adapter (OAuth2).
 *
 * Auth: OAuth2 authorization-code flow. The OAuth *app* credentials are one set
 * per deployment, supplied by the operator via env: BOX_CLIENT_ID +
 * BOX_CLIENT_SECRET (see lib/storage-providers/oauth.ts). Each tenant authorizes
 * once and we store their per-tenant access/refresh tokens (encrypted). This
 * adapter never touches the app secret directly — it calls getValidAccessToken(ctx)
 * to obtain a fresh bearer token (auto-refreshes + persists).
 *
 * ctx.secret expects: { access_token, refresh_token, expires_at } (managed by oauth.ts).
 * ctx.config expects: nothing required.
 * ctx.rootPath (optional): a Box folder id to use as the starting folder. Box's
 *   root folder id is the literal string '0'.
 *
 * Locators ('path'): a Box item id. Folders and files are both addressed by id.
 *   The root folder id is '0'.
 *
 * Endpoints:
 *   API base:    https://api.box.com/2.0
 *   Upload base: https://upload.box.com/api/2.0
 */
import type {
  ConnectorCtx,
  ListResult,
  ProviderId,
  StorageItem,
  StorageProvider,
} from './types';
import { getValidAccessToken } from './oauth';

const API = 'https://api.box.com/2.0';
const UPLOAD = 'https://upload.box.com/api/2.0';
const ROOT = '0';

export function make(ctx: ConnectorCtx): StorageProvider {
  const provider: ProviderId = 'box';

  async function authHeader(): Promise<Record<string, string>> {
    const token = await getValidAccessToken(ctx);
    return { Authorization: `Bearer ${token}` };
  }

  /** Fetch JSON from Box, throwing a descriptive Error on failure. */
  async function boxJson(url: string, init: RequestInit = {}): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
    const headers = { ...(await authHeader()), ...(init.headers || {}) };
    const res = await fetch(url, { ...init, headers });
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.text()).slice(0, 400); } catch { /* ignore */ }
      throw new Error(`Box: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ''}`);
    }
    const ct = res.headers.get('content-type') || '';
    return ct.includes('json') ? res.json() : res.text();
  }

  function rootFolder(): string {
    const r = (ctx.rootPath ?? '').toString().trim();
    return r || ROOT;
  }

  function mapEntry(entry: any): StorageItem { // eslint-disable-line @typescript-eslint/no-explicit-any
    const isFolder = entry.type === 'folder';
    return {
      name: entry.name,
      path: String(entry.id),
      kind: isFolder ? 'folder' : 'file',
      size: typeof entry.size === 'number' ? entry.size : null,
      modified: entry.modified_at ?? null,
      mime: null,
      externalId: String(entry.id),
    };
  }

  return {
    provider,

    async test() {
      try {
        const me = await boxJson(`${API}/users/me`);
        return { ok: true, account: me.login || me.name || undefined };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },

    async list(path?: string | null): Promise<ListResult> {
      const folderId = (path ?? '').toString().trim() || rootFolder();

      // Page through the folder's items.
      const items: StorageItem[] = [];
      let offset = 0;
      const limit = 1000;
      // Box caps limit at 1000; loop until we've drained total_count.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const url =
          `${API}/folders/${encodeURIComponent(folderId)}/items` +
          `?fields=id,name,type,size,modified_at&limit=${limit}&offset=${offset}`;
        const data = await boxJson(url);
        const entries: any[] = Array.isArray(data.entries) ? data.entries : []; // eslint-disable-line @typescript-eslint/no-explicit-any
        for (const entry of entries) items.push(mapEntry(entry));
        const total = typeof data.total_count === 'number' ? data.total_count : items.length;
        offset += entries.length;
        if (entries.length === 0 || offset >= total) break;
      }

      // Resolve the parent folder id (root '0' has no parent).
      let parent: string | null = null;
      if (folderId !== ROOT) {
        try {
          const meta = await boxJson(`${API}/folders/${encodeURIComponent(folderId)}?fields=parent`);
          parent = meta?.parent?.id ? String(meta.parent.id) : null;
        } catch {
          parent = null;
        }
      }

      return { items, path: folderId, parent };
    },

    async download(path: string): Promise<{ bytes: Buffer; name: string; mime?: string | null }> {
      const fileId = String(path);

      // Name (and mime hint) via metadata.
      const meta = await boxJson(`${API}/files/${encodeURIComponent(fileId)}?fields=name`);
      const name = meta?.name || fileId;

      // Content endpoint returns 302 → CDN; fetch follows redirects by default.
      const res = await fetch(`${API}/files/${encodeURIComponent(fileId)}/content`, {
        headers: await authHeader(),
        redirect: 'follow',
      });
      // 202 = file not ready yet (just uploaded / still processing). res.ok is true
      // for 202, so without this it would return a 0-byte Buffer silently.
      if (res.status === 202) {
        const retry = res.headers.get('retry-after') || '1';
        throw new Error(`Box: file not ready for download yet — retry after ${retry}s`);
      }
      if (!res.ok) {
        let detail = '';
        try { detail = (await res.text()).slice(0, 400); } catch { /* ignore */ }
        throw new Error(`Box: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ''}`);
      }
      const bytes = Buffer.from(await res.arrayBuffer());
      const mime = res.headers.get('content-type') || null;
      return { bytes, name, mime };
    },

    async upload(
      destFolder: string | null,
      name: string,
      bytes: Buffer,
      mime?: string | null,
    ): Promise<{ path: string; externalId?: string | null }> {
      const parentId = (destFolder ?? '').toString().trim() || rootFolder();

      const form = new FormData();
      form.append(
        'attributes',
        JSON.stringify({ name, parent: { id: parentId } }),
      );
      // Wrap the Buffer in a Blob so multipart boundaries are set correctly.
      const blob = new Blob([new Uint8Array(bytes)], mime ? { type: mime } : undefined);
      form.append('file', blob, name);

      const res = await fetch(`${UPLOAD}/files/content`, {
        method: 'POST',
        headers: await authHeader(), // do NOT set Content-Type; fetch adds the multipart boundary
        body: form,
      });
      if (!res.ok) {
        let detail = '';
        try { detail = (await res.text()).slice(0, 400); } catch { /* ignore */ }
        throw new Error(`Box: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ''}`);
      }
      const data = await res.json();
      const entry = Array.isArray(data.entries) ? data.entries[0] : undefined;
      const id = entry?.id ? String(entry.id) : '';
      return { path: id, externalId: id || null };
    },

    async remove(path: string): Promise<void> {
      const fileId = String(path);
      const res = await fetch(`${API}/files/${encodeURIComponent(fileId)}`, {
        method: 'DELETE',
        headers: await authHeader(),
      });
      // 204 No Content on success.
      if (!res.ok && res.status !== 204) {
        let detail = '';
        try { detail = (await res.text()).slice(0, 400); } catch { /* ignore */ }
        throw new Error(`Box: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ''}`);
      }
    },

    async link(path: string): Promise<string | null> {
      const fileId = String(path);
      try {
        const data = await boxJson(`${API}/files/${encodeURIComponent(fileId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shared_link: { access: 'open' } }),
        });
        return data?.shared_link?.url || null;
      } catch {
        // Shared-link creation may be disabled by enterprise policy.
        return null;
      }
    },
  };
}
