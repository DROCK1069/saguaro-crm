/**
 * Google Drive storage adapter (OAuth2).
 *
 * Auth: per-tenant OAuth access/refresh tokens obtained via the shared oauth.ts
 * consent flow. This adapter calls getValidAccessToken(ctx) for every request so
 * expired access tokens are transparently refreshed + persisted. The OAuth *app*
 * credentials are ONE set per deployment, supplied by the operator via env:
 *   - GOOGLE_CLIENT_ID
 *   - GOOGLE_CLIENT_SECRET
 * (These are consumed inside oauth.ts, not here.)
 *
 * ctx fields this adapter uses:
 *   - ctx.secret : { access_token, refresh_token, expires_at }  (managed by oauth.ts)
 *   - ctx.rootPath (optional) : a Drive folder id to use as the starting folder
 *       when list() is called with no path. Defaults to the special id 'root'
 *       (the user's My Drive root). Shared Drives are supported via the
 *       supportsAllDrives / includeItemsFromAllDrives flags.
 *
 * Locators ('path'): a Google Drive item id. Folders are listed by their id;
 * files are downloaded/exported by their id. The special id 'root' means My Drive.
 *
 * Endpoints:
 *   - Base   : https://www.googleapis.com/drive/v3
 *   - Upload : https://www.googleapis.com/upload/drive/v3
 *
 * Native Google Docs editor files (Docs/Sheets/Slides) have no binary content and
 * cannot be fetched with alt=media; they are exported (docs->pdf, sheets->xlsx,
 * slides->pdf) instead. See download().
 */
import type {
  ConnectorCtx,
  ListResult,
  StorageItem,
  StorageProvider,
} from './types';
import { apiFetch } from './types';
import { getValidAccessToken } from './oauth';

const BASE = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

const FOLDER_MIME = 'application/vnd.google-apps.folder';

/** Map of native Google editor mime -> { export mime, filename extension }. */
const GOOGLE_EXPORT: Record<string, { mime: string; ext: string }> = {
  'application/vnd.google-apps.document': {
    mime: 'application/pdf',
    ext: '.pdf',
  },
  'application/vnd.google-apps.spreadsheet': {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ext: '.xlsx',
  },
  'application/vnd.google-apps.presentation': {
    mime: 'application/pdf',
    ext: '.pdf',
  },
  'application/vnd.google-apps.drawing': {
    mime: 'application/pdf',
    ext: '.pdf',
  },
};

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  parents?: string[];
}

export function make(ctx: ConnectorCtx): StorageProvider {
  async function authHeader(): Promise<Record<string, string>> {
    const token = await getValidAccessToken(ctx);
    return { Authorization: `Bearer ${token}` };
  }

  function rootId(): string {
    const r = (ctx.rootPath || '').trim();
    return r || 'root';
  }

  return {
    provider: 'gdrive',

    async test() {
      try {
        const headers = await authHeader();
        const about = await apiFetch(`${BASE}/about?fields=user`, { headers });
        return { ok: true, account: about?.user?.emailAddress || undefined };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },

    async list(path?: string | null): Promise<ListResult> {
      const headers = await authHeader();
      const folderId = (path && path.trim()) || rootId();

      const q = `'${folderId}' in parents and trashed=false`;
      const items: StorageItem[] = [];
      let pageToken: string | undefined;

      do {
        const params = new URLSearchParams({
          q,
          fields:
            'files(id,name,mimeType,size,modifiedTime,parents),nextPageToken',
          pageSize: '200',
          supportsAllDrives: 'true',
          includeItemsFromAllDrives: 'true',
        });
        if (pageToken) params.set('pageToken', pageToken);

        const data = await apiFetch(`${BASE}/files?${params.toString()}`, {
          headers,
        });

        for (const f of (data?.files || []) as DriveFile[]) {
          const isFolder = f.mimeType === FOLDER_MIME;
          items.push({
            name: f.name,
            path: f.id,
            kind: isFolder ? 'folder' : 'file',
            size: f.size != null ? Number(f.size) : null,
            modified: f.modifiedTime ?? null,
            mime: f.mimeType ?? null,
            externalId: f.id,
          });
        }
        pageToken = data?.nextPageToken || undefined;
      } while (pageToken);

      // Resolve the parent of the folder we listed (null at the configured root).
      let parent: string | null = null;
      if (folderId !== 'root' && folderId !== rootId()) {
        try {
          const meta = (await apiFetch(
            `${BASE}/files/${encodeURIComponent(
              folderId,
            )}?fields=parents&supportsAllDrives=true`,
            { headers },
          )) as DriveFile;
          parent = meta?.parents?.[0] || null;
        } catch {
          parent = null;
        }
      }

      return { items, path: folderId, parent };
    },

    async download(path: string) {
      const headers = await authHeader();

      // Fetch metadata to learn name + mimeType (decides download vs export).
      const meta = (await apiFetch(
        `${BASE}/files/${encodeURIComponent(
          path,
        )}?fields=name,mimeType&supportsAllDrives=true`,
        { headers },
      )) as DriveFile;

      const nativeExport = GOOGLE_EXPORT[meta.mimeType];

      if (meta.mimeType?.startsWith('application/vnd.google-apps.')) {
        if (!nativeExport) {
          throw new Error(
            `Google Drive: this file type (${meta.mimeType}) cannot be downloaded or exported.`,
          );
        }
        const res = await apiFetch(
          `${BASE}/files/${encodeURIComponent(
            path,
          )}/export?mimeType=${encodeURIComponent(
            nativeExport.mime,
          )}&supportsAllDrives=true`,
          { headers, raw: true },
        );
        const arr = await res.arrayBuffer();
        const name = meta.name?.toLowerCase().endsWith(nativeExport.ext)
          ? meta.name
          : `${meta.name || 'export'}${nativeExport.ext}`;
        return { bytes: Buffer.from(arr), name, mime: nativeExport.mime };
      }

      // Regular binary file: alt=media stream.
      const res = await apiFetch(
        `${BASE}/files/${encodeURIComponent(
          path,
        )}?alt=media&supportsAllDrives=true`,
        { headers, raw: true },
      );
      const arr = await res.arrayBuffer();
      return {
        bytes: Buffer.from(arr),
        name: meta.name || path,
        mime: meta.mimeType || null,
      };
    },

    async upload(
      destFolder: string | null,
      name: string,
      bytes: Buffer,
      mime?: string | null,
    ) {
      const headers = await authHeader();
      const parent = (destFolder && destFolder.trim()) || rootId();
      const contentType = mime || 'application/octet-stream';

      const boundary = `saguaro-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;
      const metadata = { name, parents: [parent] };

      const preamble = Buffer.from(
        `--${boundary}\r\n` +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          `${JSON.stringify(metadata)}\r\n` +
          `--${boundary}\r\n` +
          `Content-Type: ${contentType}\r\n\r\n`,
        'utf8',
      );
      const epilogue = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
      const body = Buffer.concat([preamble, bytes, epilogue]);

      const created = (await apiFetch(
        `${UPLOAD}/files?uploadType=multipart&supportsAllDrives=true&fields=id`,
        {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': `multipart/related; boundary=${boundary}`,
            'Content-Length': String(body.length),
          },
          body,
        },
      )) as DriveFile;

      return { path: created.id, externalId: created.id };
    },

    async remove(path: string) {
      const headers = await authHeader();
      await apiFetch(
        `${BASE}/files/${encodeURIComponent(path)}?supportsAllDrives=true`,
        { method: 'DELETE', headers, raw: true },
      );
    },

    async link(path: string) {
      return `https://drive.google.com/file/d/${encodeURIComponent(path)}/view`;
    },
  };
}
