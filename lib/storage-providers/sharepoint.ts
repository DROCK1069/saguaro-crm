/**
 * SharePoint document-library adapter (Microsoft Graph, OAuth2).
 *
 * Reads/writes a SharePoint site's document library via the Microsoft Graph
 * `/drives/{driveId}` API. Auth is per-tenant OAuth: the operator registers ONE
 * Azure AD app (env MS_CLIENT_ID / MS_CLIENT_SECRET, see oauth.ts) and each
 * tenant authorizes once; `getValidAccessToken(ctx)` returns a fresh bearer
 * token (auto-refreshing + persisting) on every call.
 *
 * ctx.config:
 *   - siteId  (required) : the Graph site id, e.g. the value from
 *                          GET /sites/{hostname}:/sites/{path} → id. Resolves the
 *                          library's default drive when driveId is omitted.
 *   - driveId (optional) : a specific document library's drive id. If absent we
 *                          resolve GET /sites/{siteId}/drive → id (default library).
 * ctx.secret:
 *   - { access_token, refresh_token, expires_at } (managed by oauth.ts)
 *
 * ctx.rootPath (optional): a Graph item id used as the starting folder for
 *   list() when called with no path (defaults to the drive root).
 *
 * Path model: `path` is a Graph driveItem id (the same id OneDrive uses).
 * Folders and files both use their item id; the drive root uses the literal
 * sentinel 'root'.
 */
import type { ConnectorCtx, StorageProvider, StorageItem, ListResult } from './types';
import { apiFetch } from './types';
import { getValidAccessToken } from './oauth';

const GRAPH = 'https://graph.microsoft.com/v1.0';
const UPLOAD_SESSION_THRESHOLD = 4 * 1024 * 1024; // 4 MiB — Graph simple-PUT ceiling

export function make(ctx: ConnectorCtx): StorageProvider {
  const siteId: string = ctx.config?.siteId;
  if (!siteId) throw new Error('SharePoint: config.siteId is required');

  let cachedDriveId: string | null = ctx.config?.driveId || null;

  async function auth(): Promise<Record<string, string>> {
    const token = await getValidAccessToken(ctx);
    return { Authorization: `Bearer ${token}` };
  }

  /** Resolve (and cache) the document-library drive id. */
  async function driveId(): Promise<string> {
    if (cachedDriveId) return cachedDriveId;
    const drive = await apiFetch(`${GRAPH}/sites/${encodeURIComponent(siteId)}/drive`, {
      headers: await auth(),
    });
    if (!drive?.id) throw new Error('SharePoint: could not resolve default document-library drive for this site');
    cachedDriveId = drive.id as string;
    return cachedDriveId;
  }

  function mapItem(it: any): StorageItem { // eslint-disable-line @typescript-eslint/no-explicit-any
    const isFolder = !!it.folder;
    return {
      name: it.name,
      path: it.id,
      kind: isFolder ? 'folder' : 'file',
      size: typeof it.size === 'number' ? it.size : null,
      modified: it.lastModifiedDateTime || null,
      mime: isFolder ? null : (it.file?.mimeType || null),
      externalId: it.id || null,
    };
  }

  return {
    provider: 'sharepoint',

    async test() {
      try {
        const site = await apiFetch(`${GRAPH}/sites/${encodeURIComponent(siteId)}`, {
          headers: await auth(),
        });
        return { ok: true, account: site?.displayName || site?.name || site?.webUrl || siteId };
      } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        return { ok: false, error: e?.message || 'SharePoint test failed' };
      }
    },

    async list(path?: string | null): Promise<ListResult> {
      const drv = await driveId();
      const headers = await auth();
      const target = path || ctx.rootPath || null;

      const childrenUrl = target && target !== 'root'
        ? `${GRAPH}/drives/${drv}/items/${encodeURIComponent(target)}/children`
        : `${GRAPH}/drives/${drv}/root/children`;

      // Page through children (Graph returns @odata.nextLink for large folders).
      const items: StorageItem[] = [];
      let next: string | null = childrenUrl;
      while (next) {
        const page: any = await apiFetch(next, { headers }); // eslint-disable-line @typescript-eslint/no-explicit-any
        for (const it of page.value || []) items.push(mapItem(it));
        next = page['@odata.nextLink'] || null;
      }

      // Determine the parent folder locator for "up" navigation.
      let parent: string | null = null;
      if (target && target !== 'root') {
        try {
          const meta: any = await apiFetch(`${GRAPH}/drives/${drv}/items/${encodeURIComponent(target)}`, { headers }); // eslint-disable-line @typescript-eslint/no-explicit-any
          const pr = meta?.parentReference;
          // parentReference.id present only when the parent isn't the drive root
          parent = pr?.id ? pr.id : (pr ? 'root' : null);
        } catch { /* non-fatal — leave parent null */ }
      }

      return { items, path: target || 'root', parent };
    },

    async download(path: string): Promise<{ bytes: Buffer; name: string; mime?: string | null }> {
      const drv = await driveId();
      const headers = await auth();

      // Fetch metadata for name + mime, then stream content.
      const meta: any = await apiFetch(`${GRAPH}/drives/${drv}/items/${encodeURIComponent(path)}`, { headers }); // eslint-disable-line @typescript-eslint/no-explicit-any
      const res: Response = await apiFetch(`${GRAPH}/drives/${drv}/items/${encodeURIComponent(path)}/content`, {
        headers,
        raw: true,
      });
      const bytes = Buffer.from(await res.arrayBuffer());
      return {
        bytes,
        name: meta?.name || path,
        mime: meta?.file?.mimeType || res.headers.get('content-type') || null,
      };
    },

    async upload(destFolder: string | null, name: string, bytes: Buffer, mime?: string | null): Promise<{ path: string; externalId?: string | null }> {
      const drv = await driveId();
      const headers = await auth();
      const folder = destFolder || 'root';

      if (bytes.length < UPLOAD_SESSION_THRESHOLD) {
        // Simple PUT: /drives/{driveId}/items/{parent}:/{name}:/content
        const url = `${GRAPH}/drives/${drv}/items/${encodeURIComponent(folder)}:/${encodeURIComponent(name)}:/content`;
        const item: any = await apiFetch(url, { // eslint-disable-line @typescript-eslint/no-explicit-any
          method: 'PUT',
          headers: { ...headers, 'Content-Type': mime || 'application/octet-stream' },
          body: new Uint8Array(bytes),
        });
        return { path: item.id, externalId: item.id || null };
      }

      // Large file: resumable upload session, chunked in 320 KiB multiples.
      const sessionUrl = `${GRAPH}/drives/${drv}/items/${encodeURIComponent(folder)}:/${encodeURIComponent(name)}:/createUploadSession`;
      const session: any = await apiFetch(sessionUrl, { // eslint-disable-line @typescript-eslint/no-explicit-any
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace', name } }),
      });
      const uploadUrl: string = session.uploadUrl;
      if (!uploadUrl) throw new Error('SharePoint: failed to create upload session');

      const CHUNK = 10 * 320 * 1024; // 3.2 MiB (must be a multiple of 320 KiB)
      const total = bytes.length;
      let offset = 0;
      let last: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
      while (offset < total) {
        const end = Math.min(offset + CHUNK, total);
        const chunk = bytes.subarray(offset, end);
        // The upload-session URL is pre-authenticated; do NOT send the bearer header.
        last = await apiFetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Length': String(chunk.length),
            'Content-Range': `bytes ${offset}-${end - 1}/${total}`,
          },
          body: new Uint8Array(chunk),
        });
        offset = end;
      }
      const id = last?.id;
      if (!id) throw new Error('SharePoint: upload session did not return a drive item');
      return { path: id, externalId: id };
    },

    async remove(path: string): Promise<void> {
      const drv = await driveId();
      const headers = await auth();
      await apiFetch(`${GRAPH}/drives/${drv}/items/${encodeURIComponent(path)}`, {
        method: 'DELETE',
        headers,
        raw: true,
      });
    },

    async link(path: string): Promise<string | null> {
      const drv = await driveId();
      const headers = await auth();
      const res: any = await apiFetch(`${GRAPH}/drives/${drv}/items/${encodeURIComponent(path)}/createLink`, { // eslint-disable-line @typescript-eslint/no-explicit-any
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'view', scope: 'organization' }),
      });
      return res?.link?.webUrl || null;
    },
  };
}
