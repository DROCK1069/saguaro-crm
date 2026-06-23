/**
 * lib/email-ingest.ts — parse an inbound email webhook payload into a
 * correspondence record and resolve which project it belongs to.
 *
 * Works with the standard inbound-parse shape used by SendGrid/Mailgun/Postmark
 * (from, to, cc, subject, text/html). Project resolution looks for a reference
 * token in the subject ([PRJ-xxxx] or "Saguaro #ref") or a plus-addressed
 * recipient (project+<projectId>@inbound.saguaro...).
 */

export interface InboundEmail {
  from?: string;
  to?: string | string[];
  cc?: string | string[];
  subject?: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
}

export interface ParsedCorrespondence {
  project_ref: string | null;
  project_id: string | null;
  from_email: string;
  from_name: string | null;
  to_names: string[];
  cc_names: string[];
  subject: string;
  body: string;
  reference_number: string | null;
  correspondence_type: 'Email Record';
  direction: 'inbound';
  status: 'Received';
}

function addr(v?: string | string[]): string[] {
  if (!v) return [];
  const arr = Array.isArray(v) ? v : v.split(',');
  return arr.map((s) => s.trim()).filter(Boolean);
}

function nameOf(emailStr: string): { name: string | null; email: string } {
  const m = emailStr.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || null, email: m[2].trim().toLowerCase() };
  return { name: null, email: emailStr.trim().toLowerCase() };
}

/** Extract a project reference + (if plus-addressed) the raw project id. */
export function resolveProjectRef(email: InboundEmail): { ref: string | null; plusId: string | null } {
  const subj = email.subject || '';
  const refMatch = subj.match(/\[PRJ-([A-Za-z0-9_-]+)\]/) || subj.match(/Saguaro\s*#\s*([A-Za-z0-9_-]+)/i);
  const ref = refMatch ? refMatch[1] : null;

  let plusId: string | null = null;
  for (const t of addr(email.to)) {
    const { email: e } = nameOf(t);
    const plus = e.match(/\+([A-Za-z0-9-]+)@/);
    if (plus) { plusId = plus[1]; break; }
  }
  return { ref, plusId };
}

export function parseInboundEmail(email: InboundEmail): ParsedCorrespondence {
  const fromParsed = nameOf(email.from || '');
  const { ref, plusId } = resolveProjectRef(email);
  const body = (email.text || stripHtml(email.html || '') || '').trim();
  return {
    project_ref: ref,
    project_id: plusId, // a UUID-shaped plus address resolves directly
    from_email: fromParsed.email,
    from_name: fromParsed.name,
    to_names: addr(email.to).map((t) => nameOf(t).email),
    cc_names: addr(email.cc).map((t) => nameOf(t).email),
    subject: email.subject || '(no subject)',
    body,
    reference_number: ref,
    correspondence_type: 'Email Record',
    direction: 'inbound',
    status: 'Received',
  };
}

function stripHtml(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
