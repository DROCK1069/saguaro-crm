/**
 * OneDrive storage adapter (Microsoft Graph, OAuth2).
 *
 * Auth: OAuth2 (authorization_code + refresh). The Azure app credentials are ONE
 * operator-supplied set shared by all tenants, provided via env:
 *   MS_CLIENT_ID, MS_CLIENT_SECRET
 * (see lib/storage-providers/oauth.ts — provider 'onedrive'). Each tenant
 * authorizes once; per-tenant tokens live in ctx.secret {access_token,
 * refresh_token, expires_at}. We NEVER read the client id/secret here — we call
 * getValidAccessToken(ctx) which refreshes + persists transparently and hands
 * back a fresh bearer.
 *
 * ctx.config: (none required)
 *   - rootPath (ctx.rootPath, optional): a drive item id to use as the starting
 *     folder for list() when no path is passed. When absent we list the drive root.
 * ctx.secret: { access_token, refresh_token, expires_at } — populated by the
 *   OAuth callback (lib/storage-providers/oauth.ts::exchangeCode).
 *
 * 'path' semantics for this provider: a Graph driveItem id. Folders and files
 * are both addressed by their item id. The drive root is addressed by the
 * special value 'root' in Graph URLs; we surface the root's children when list()
 * is called with no path (or the configured rootPath).
 *
 * Graph base: https://graph.microsoft.com/v1.0 against /me/drive (the signed-in
 * user's default OneDrive).
 */
import type { ConnectorCtx, ListResult, StorageItem, StorageProvider } from './types';
import { apiFetch } from './types';
import { getValidAccessToken } from './oauth';

const GRAPH = 'https://graph.microsoft.com/v1.0';
const SIMPLE_UPLOAD_LIMIT = 4 * 1024 * 1024; // 4 MB — Graph's simple-PUT ceiling

export function make(ctx: ConnectorCtx): StorageProvider {
  async function auth(): Promise<Record<string, string>> {
    const token = await getValidAccessToken(ctx);
    return { Authorization: `Bearer ${token}` };
  }

  function mapItem(child: any): StorageItem { // eslint-disable-line @typescript-eslint/no-explicit-any
    const isFolder = !!child.folder;
    return {
      name: child.name,
      path: child.id,
      kind: isFolder ? 'folder' : 'file',
      size: typeof child.size === 'number' ? child.size : null,
      modified: child.lastModifiedDateTime || null,
      mime: isFolder ? null : (child.file?.mimeType || null),
      externalId: child.id,
    };
  }

  return {
    provider: 'onedrive',

    async test() {
      try {
        const me = await apiFetch(`${GRAPH}/me`, { headers: await auth() });
        return { ok: true, account: me.mail || me.userPrincipalName || me.displayName || undefined };
      } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        return { ok: false, error: e?.message || String(e) };
      }
    },

    async list(path?: string | null): Promise<ListResult> {
      const headers = await auth();
      const raw = path || ctx.rootPath || null;
      // The literal 'root' (what we surface as the root locator) is NOT a valid
      // item id for /me/drive/items/{id} — root must go through /me/drive/root.
      const isRoot = !raw || raw === 'root';
      const target = isRoot ? null : raw;

      const childrenUrl = isRoot
        ? `${GRAPH}/me/drive/root/children`
        : `${GRAPH}/me/drive/items/${encodeURIComponent(target as string)}/children`;

      const items: StorageItem[] = [];
      let url: string | null = `${childrenUrl}?$top=200`;
      while (url) {
        const page: any = await apiFetch(url, { headers }); // eslint-disable-line @typescript-eslint/no-explicit-any
        for (const child of page.value || []) items.push(mapItem(child));
        url = page['@odata.nextLink'] || null;
      }

      // Resolve the parent folder locator so the UI can navigate "up" (skip at root).
      let parent: string | null = null;
      if (!isRoot) {
        try {
          const meta: any = await apiFetch( // eslint-disable-line @typescript-eslint/no-explicit-any
            `${GRAPH}/me/drive/items/${encodeURIComponent(target as string)}`,
            { headers },
          );
          parent = meta?.parentReference?.id || null;
        } catch { /* non-fatal — leave parent null */ }
      }

      return { items, path: isRoot ? 'root' : (target as string), parent };
    },

    async download(path: string) {
      const headers = await auth();
      const [meta, res] = await Promise.all([
        apiFetch(`${GRAPH}/me/drive/items/${encodeURIComponent(path)}`, { headers }),
        apiFetch(`${GRAPH}/me/drive/items/${encodeURIComponent(path)}/content`, { headers, raw: true }),
      ]);
      const buf = Buffer.from(await res.arrayBuffer());
      const mime = res.headers?.get?.('content-type') || meta?.file?.mimeType || null;
      return { bytes: buf, name: meta?.name || path, mime };
    },

    async upload(destFolder: string | null, name: string, bytes: Buffer, mime?: string | null) {
      const headers = await auth();
      const folder = destFolder || ctx.rootPath || null;
      const isRoot = !folder || folder === 'root';
      const contentType = mime || 'application/octet-stream';
      // Root must be addressed as /me/drive/root:/name: — the literal id 'root'
      // is NOT valid under /me/drive/items/{id}.
      const base = isRoot
        ? `${GRAPH}/me/drive/root:/${encodeURIComponent(name)}:`
        : `${GRAPH}/me/drive/items/${encodeURIComponent(folder as string)}:/${encodeURIComponent(name)}:`;

      if (bytes.length < SIMPLE_UPLOAD_LIMIT) {
        const created: any = await apiFetch(`${base}/content`, { // eslint-disable-line @typescript-eslint/no-explicit-any
          method: 'PUT',
          headers: { ...headers, 'Content-Type': contentType },
          body: new Uint8Array(bytes),
        });
        return { path: created.id, externalId: created.id };
      }

      // Large upload: session + sequential ranges (Graph caps a single PUT < 60 MiB;
      // each range must be a multiple of 320 KiB except the last).
      const session: any = await apiFetch(`${base}/createUploadSession`, { // eslint-disable-line @typescript-eslint/no-explicit-any
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace', name } }),
      });
      if (!session?.uploadUrl) throw new Error('OneDrive: createUploadSession returned no uploadUrl');

      const total = bytes.length;
      const CHUNK = 40 * 320 * 1024; // 12.8 MB — multiple of 320 KiB, under 60 MiB
      let start = 0;
      let created: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
      while (start < total) {
        const end = Math.min(start + CHUNK, total);
        const chunk = bytes.subarray(start, end);
        // uploadUrl is pre-authenticated — do NOT send the bearer. Final range returns the item.
        created = await apiFetch(session.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Length': String(chunk.length), 'Content-Range': `bytes ${start}-${end - 1}/${total}` },
          body: new Uint8Array(chunk),
        });
        start = end;
      }
      return { path: created?.id, externalId: created?.id };
    },

    async remove(path: string) {
      await apiFetch(`${GRAPH}/me/drive/items/${encodeURIComponent(path)}`, {
        method: 'DELETE',
        headers: await auth(),
        raw: true,
      });
    },

    async link(path: string) {
      const created: any = await apiFetch( // eslint-disable-line @typescript-eslint/no-explicit-any
        `${GRAPH}/me/drive/items/${encodeURIComponent(path)}/createLink`,
        {
          method: 'POST',
          headers: { ...(await auth()), 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'view', scope: 'organization' }),
        },
      );
      return created?.link?.webUrl || null;
    },
  };
}
