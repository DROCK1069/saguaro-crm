/**
 * Dropbox storage adapter (OAuth2).
 *
 * Auth: per-tenant OAuth tokens. We never touch the app credentials directly —
 * getValidAccessToken(ctx) returns a fresh bearer token, auto-refreshing +
 * persisting via ctx.saveSecret. The OAuth *app* (one per deployment) is
 * configured via env DROPBOX_APP_KEY + DROPBOX_APP_SECRET (see oauth.ts).
 *
 * ctx.secret  : { access_token, refresh_token, expires_at }  (managed by oauth.ts)
 * ctx.config  : (none required)
 * ctx.rootPath: optional Dropbox folder to start listing from. Dropbox's account
 *               root is the EMPTY STRING '' (not '/'). A sub-folder locator looks
 *               like '/projects/2026'.
 *
 * Provider-native locator ('path' in the interface) = a Dropbox path_lower
 * (e.g. '/projects/2026/plan.pdf'). Folders and files both use this.
 *
 * API surface:
 *   RPC base     https://api.dropboxapi.com/2      (JSON in / JSON out)
 *   Content base https://content.dropboxapi.com/2  (bytes; args in Dropbox-API-Arg header)
 * Bearer auth on every call.
 */
import type {
  ConnectorCtx,
  ListResult,
  StorageItem,
  StorageProvider,
} from './types';
import { getValidAccessToken } from './oauth';

const RPC = 'https://api.dropboxapi.com/2';
const CONTENT = 'https://content.dropboxapi.com/2';

/** Dropbox-API-Arg must be ASCII-safe: escape any non-ASCII to \uXXXX. */
function apiArg(obj: unknown): string {
  return JSON.stringify(obj).replace(/[-￿]/g, (c) =>
    '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'),
  );
}

/** Normalize a locator to Dropbox rules: root is '' (empty), not '/'. */
function normPath(p?: string | null): string {
  const v = (p ?? '').trim();
  if (!v || v === '/') return '';
  return v.startsWith('/') ? v : '/' + v;
}

/** Parent folder locator of a Dropbox path ('' when at/above root). */
function parentOf(p: string): string | null {
  const v = normPath(p);
  if (!v) return null;
  const i = v.lastIndexOf('/');
  return i <= 0 ? '' : v.slice(0, i);
}

function lastSegment(p: string): string {
  const v = normPath(p);
  const i = v.lastIndexOf('/');
  return i >= 0 ? v.slice(i + 1) : v;
}

export function make(ctx: ConnectorCtx): StorageProvider {
  /** POST JSON to an RPC endpoint with a fresh bearer token. */
  async function rpc(path: string, body: unknown): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
    const token = await getValidAccessToken(ctx);
    const res = await fetch(`${RPC}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      // Dropbox RPC endpoints require a JSON body; some (e.g. get_current_account)
      // take literal null.
      body: body === undefined ? 'null' : JSON.stringify(body),
    });
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.text()).slice(0, 400); } catch { /* ignore */ }
      throw new Error(`Dropbox: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ''}`);
    }
    const ct = res.headers.get('content-type') || '';
    return ct.includes('json') ? res.json() : res.text();
  }

  function toItem(entry: any): StorageItem { // eslint-disable-line @typescript-eslint/no-explicit-any
    const isFolder = entry['.tag'] === 'folder';
    const loc: string = entry.path_lower || entry.path_display || '';
    return {
      name: entry.name,
      path: loc,
      kind: isFolder ? 'folder' : 'file',
      size: isFolder ? null : (typeof entry.size === 'number' ? entry.size : null),
      modified: isFolder ? null : (entry.server_modified || null),
      mime: null, // Dropbox metadata doesn't carry a content-type
      externalId: entry.id || null,
    };
  }

  return {
    provider: 'dropbox',

    async test() {
      try {
        const acct = await rpc('/users/get_current_account', undefined);
        const email: string | undefined = acct?.email
          || acct?.name?.display_name
          || undefined;
        return { ok: true, account: email };
      } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        return { ok: false, error: e?.message || String(e) };
      }
    },

    async list(path?: string | null): Promise<ListResult> {
      const folder = normPath(path ?? ctx.rootPath ?? '');
      const items: StorageItem[] = [];

      let resp = await rpc('/files/list_folder', {
        path: folder,
        recursive: false,
        include_non_downloadable_files: true,
      });
      for (const entry of resp.entries || []) items.push(toItem(entry));

      // Page through the rest via the cursor.
      while (resp.has_more) {
        resp = await rpc('/files/list_folder/continue', { cursor: resp.cursor });
        for (const entry of resp.entries || []) items.push(toItem(entry));
      }

      return {
        items,
        path: folder,
        parent: folder === '' ? null : parentOf(folder),
      };
    },

    async download(path: string) {
      const token = await getValidAccessToken(ctx);
      const loc = normPath(path);
      const res = await fetch(`${CONTENT}/files/download`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Dropbox-API-Arg': apiArg({ path: loc }),
          // Dropbox rejects a Content-Type on download; body must be empty.
        },
      });
      if (!res.ok) {
        let detail = '';
        try { detail = (await res.text()).slice(0, 400); } catch { /* ignore */ }
        throw new Error(`Dropbox download: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ''}`);
      }
      const ab = await res.arrayBuffer();
      return {
        bytes: Buffer.from(ab),
        name: lastSegment(loc),
        mime: res.headers.get('content-type') || null,
      };
    },

    async upload(destFolder: string | null, name: string, bytes: Buffer, _mime?: string | null) {
      const token = await getValidAccessToken(ctx);
      const folder = normPath(destFolder ?? ctx.rootPath ?? '');
      const target = `${folder}/${name}`; // folder '' -> '/name', folder '/a' -> '/a/name'
      const auth = { Authorization: `Bearer ${token}` };
      const SINGLE = 140 * 1024 * 1024;  // Dropbox rejects a single /files/upload over 150MB
      const CHUNK = 100 * 1024 * 1024;   // per upload_session call, well under 150MB

      const fail = async (res: Response, label: string) => {
        let detail = ''; try { detail = (await res.text()).slice(0, 400); } catch { /* ignore */ }
        throw new Error(`Dropbox ${label}: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ''}`);
      };

      // Small files: single shot.
      if (bytes.length <= SINGLE) {
        const res = await fetch(`${CONTENT}/files/upload`, {
          method: 'POST',
          headers: { ...auth, 'Dropbox-API-Arg': apiArg({ path: target, mode: 'add', autorename: true, mute: false, strict_conflict: false }), 'Content-Type': 'application/octet-stream' },
          body: new Uint8Array(bytes),
        });
        if (!res.ok) await fail(res, 'upload');
        const meta = await res.json();
        return { path: meta.path_lower || meta.path_display || target, externalId: meta.id || null };
      }

      // Large files: chunked upload_session (start → append_v2… → finish).
      const total = bytes.length;
      const startRes = await fetch(`${CONTENT}/files/upload_session/start`, {
        method: 'POST', headers: { ...auth, 'Dropbox-API-Arg': apiArg({ close: false }), 'Content-Type': 'application/octet-stream' },
        body: new Uint8Array(bytes.subarray(0, CHUNK)),
      });
      if (!startRes.ok) await fail(startRes, 'upload_session/start');
      const { session_id } = await startRes.json();
      let offset = Math.min(CHUNK, total);

      while (total - offset > CHUNK) {
        const chunk = bytes.subarray(offset, offset + CHUNK);
        const ar = await fetch(`${CONTENT}/files/upload_session/append_v2`, {
          method: 'POST', headers: { ...auth, 'Dropbox-API-Arg': apiArg({ cursor: { session_id, offset }, close: false }), 'Content-Type': 'application/octet-stream' },
          body: new Uint8Array(chunk),
        });
        if (!ar.ok) await fail(ar, 'upload_session/append');
        offset += chunk.length;
      }

      const finRes = await fetch(`${CONTENT}/files/upload_session/finish`, {
        method: 'POST',
        headers: { ...auth, 'Dropbox-API-Arg': apiArg({ cursor: { session_id, offset }, commit: { path: target, mode: 'add', autorename: true, mute: false } }), 'Content-Type': 'application/octet-stream' },
        body: new Uint8Array(bytes.subarray(offset)),
      });
      if (!finRes.ok) await fail(finRes, 'upload_session/finish');
      const meta = await finRes.json();
      return { path: meta.path_lower || meta.path_display || target, externalId: meta.id || null };
    },

    async remove(path: string): Promise<void> {
      await rpc('/files/delete_v2', { path: normPath(path) });
    },

    async link(path: string): Promise<string | null> {
      const resp = await rpc('/files/get_temporary_link', { path: normPath(path) });
      return resp?.link || null;
    },
  };
}
