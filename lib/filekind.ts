/**
 * Canonical file-kind classifier shared by upload routes + UI (web).
 * Mirrors iOS lib/files.ts fileKind(). Pure — safe on client and server.
 */
export type FileKind = 'image' | 'video' | 'audio' | 'pdf' | 'doc' | 'sheet' | 'cad' | 'other';

export function classifyKind(mime?: string | null, name?: string | null): FileKind {
  const m = (mime || '').toLowerCase();
  const ext = (name || '').toLowerCase().split('.').pop() || '';
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (m === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'tiff', 'tif', 'bmp', 'svg'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'm4v', 'webm', 'avi', 'mkv', 'hevc', '3gp'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'].includes(ext)) return 'audio';
  if (['doc', 'docx', 'txt', 'rtf', 'odt', 'pages'].includes(ext) || m.includes('word') || m.includes('opendocument.text')) return 'doc';
  if (['xls', 'xlsx', 'csv', 'ods', 'numbers'].includes(ext) || m.includes('sheet') || m.includes('excel') || m.includes('csv')) return 'sheet';
  if (['ppt', 'pptx', 'key'].includes(ext) || m.includes('presentation')) return 'doc';
  if (['dwg', 'dxf', 'dwf', 'rvt', 'ifc', 'skp', 'stp', 'step'].includes(ext)) return 'cad';
  return 'other';
}

/** Human label for a kind. */
export const KIND_LABEL: Record<FileKind, string> = {
  image: 'Image', video: 'Video', audio: 'Audio', pdf: 'PDF',
  doc: 'Document', sheet: 'Spreadsheet', cad: 'CAD', other: 'File',
};
