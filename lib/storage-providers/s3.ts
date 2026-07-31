/**
 * Amazon S3 + any S3-COMPATIBLE object store (Cloudflare R2, Backblaze B2,
 * Wasabi, MinIO, DigitalOcean Spaces). Uses the AWS SDK v3 directly.
 *
 * ctx.config:
 *   region         (string, required)  e.g. "us-east-1" (for R2 use "auto")
 *   bucket         (string, required)  the bucket name
 *   endpoint       (string, optional)  custom endpoint for S3-compatibles,
 *                                       e.g. "https://<acct>.r2.cloudflarestorage.com"
 *   forcePathStyle (bool,   optional)  true for MinIO / most non-AWS endpoints
 * ctx.secret:
 *   accessKeyId     (string, required)
 *   secretAccessKey (string, required)
 *
 * ctx.rootPath is treated as the starting key prefix (e.g. "projects/acme/").
 *
 * Locators ("path"): folders => a key prefix ending in "/"; files => the object
 * Key. Listing uses Delimiter:"/" so we walk one folder level at a time.
 */
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { ConnectorCtx, StorageProvider, StorageItem, ListResult } from './types';

/** Parent prefix one folder up from a prefix/key ("a/b/c/" -> "a/b/", "a/b/" -> "a/"). */
function parentPrefix(prefix: string): string | null {
  const trimmed = prefix.replace(/\/+$/, ''); // drop trailing slash(es)
  if (!trimmed) return null;
  const idx = trimmed.lastIndexOf('/');
  return idx === -1 ? '' : trimmed.slice(0, idx + 1);
}

/** Best-effort content-type from a file extension (S3 list doesn't return mime). */
function guessMime(key: string): string | null {
  const m = key.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (!m) return null;
  const map: Record<string, string> = {
    pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', txt: 'text/plain',
    csv: 'text/csv', json: 'application/json', xml: 'application/xml',
    zip: 'application/zip', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    dwg: 'application/acad', dxf: 'application/dxf', mp4: 'video/mp4', mov: 'video/quicktime',
  };
  return map[m[1]] || null;
}

/** Collect a GetObject body (browser/Node stream) into a Buffer. */
async function bodyToBuffer(body: any): Promise<Buffer> { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!body) return Buffer.alloc(0);
  // SDK v3 Node/browser streams expose transformToByteArray().
  if (typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray());
  }
  // Fallback: async-iterate a Node Readable.
  if (typeof body[Symbol.asyncIterator] === 'function') {
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  // Fallback: a web ReadableStream with getReader().
  if (typeof body.getReader === 'function') {
    const reader = body.getReader();
    const chunks: Buffer[] = [];
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  }
  throw new Error('S3: unsupported response body type');
}

export function make(ctx: ConnectorCtx): StorageProvider {
  const cfg = ctx.config || {};
  const region = String(cfg.region || '').trim();
  const bucket = String(cfg.bucket || '').trim();
  const endpoint = cfg.endpoint ? String(cfg.endpoint).trim() : undefined;
  const forcePathStyle = cfg.forcePathStyle === true || cfg.forcePathStyle === 'true';

  const accessKeyId = String((ctx.secret || {}).accessKeyId || '').trim();
  const secretAccessKey = String((ctx.secret || {}).secretAccessKey || '').trim();

  if (!region) throw new Error('S3: config.region is required');
  if (!bucket) throw new Error('S3: config.bucket is required');
  if (!accessKeyId || !secretAccessKey) throw new Error('S3: accessKeyId and secretAccessKey are required');

  const client = new S3Client({
    region,
    ...(endpoint ? { endpoint } : {}),
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  });

  const root = (ctx.rootPath || '').replace(/^\/+/, ''); // never a leading slash for S3 keys

  function wrap(err: unknown): Error {
    const e = err as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const msg = e?.message || String(err);
    const code = e?.name || e?.Code || e?.$metadata?.httpStatusCode;
    return new Error(`S3 (${bucket}): ${msg}${code ? ` [${code}]` : ''}`);
  }

  return {
    provider: 's3',

    async test() {
      try {
        await client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1, Prefix: root || undefined }));
        return { ok: true, account: bucket };
      } catch (err) {
        return { ok: false, error: wrap(err).message };
      }
    },

    async list(path?: string | null): Promise<ListResult> {
      const prefix = (path ?? root ?? '').replace(/^\/+/, '');
      try {
        const items: StorageItem[] = [];
        let ContinuationToken: string | undefined;
        do {
          const res = await client.send(new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            Delimiter: '/',
            ContinuationToken,
          }));

          for (const cp of res.CommonPrefixes || []) {
            const p = cp.Prefix;
            if (!p) continue;
            const label = p.replace(/\/+$/, '').split('/').pop() || p;
            items.push({ name: label, path: p, kind: 'folder' });
          }

          for (const obj of res.Contents || []) {
            const key = obj.Key;
            if (!key) continue;
            // Skip the zero-length placeholder object that represents this folder itself.
            if (key === prefix) continue;
            if (key.endsWith('/')) continue; // other folder-marker objects
            const label = key.split('/').pop() || key;
            items.push({
              name: label,
              path: key,
              kind: 'file',
              size: typeof obj.Size === 'number' ? obj.Size : null,
              modified: obj.LastModified ? new Date(obj.LastModified).toISOString() : null,
              mime: guessMime(key),
              externalId: key,
            });
          }

          ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
        } while (ContinuationToken);

        return { items, path: prefix, parent: prefix ? parentPrefix(prefix) : null };
      } catch (err) {
        throw wrap(err);
      }
    },

    async download(path: string) {
      const key = path.replace(/^\/+/, '');
      try {
        const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const bytes = await bodyToBuffer(res.Body);
        return {
          bytes,
          name: key.split('/').pop() || key,
          mime: res.ContentType || guessMime(key),
        };
      } catch (err) {
        throw wrap(err);
      }
    },

    async upload(destFolder: string | null, name: string, bytes: Buffer, mime?: string | null) {
      const folder = (destFolder ?? root ?? '').replace(/^\/+/, '');
      const key = [folder, name].filter(Boolean).join('/').replace(/\/+/g, '/');
      try {
        await client.send(new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: bytes,
          ContentType: mime || guessMime(name) || 'application/octet-stream',
        }));
        return { path: key, externalId: key };
      } catch (err) {
        throw wrap(err);
      }
    },

    async remove(path: string) {
      const key = path.replace(/^\/+/, '');
      try {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      } catch (err) {
        throw wrap(err);
      }
    },

    async link(path: string) {
      const key = path.replace(/^\/+/, '');
      try {
        return await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 3600 });
      } catch (err) {
        throw wrap(err);
      }
    },
  };
}
