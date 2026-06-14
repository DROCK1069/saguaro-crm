import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

async function authenticateSubPortal(req: NextRequest) {
  const token =
    req.nextUrl.searchParams.get('token') ||
    req.headers.get('x-portal-token');
  if (!token) return null;

  const db = createServerClient();
  const { data: session } = await db
    .from('portal_sub_sessions')
    .select('*')
    .eq('token', token)
    .eq('status', 'active')
    .single();

  return session;
}

/** GET — List compliance documents for this sub with expiration tracking */
export async function GET(req: NextRequest) {
  try {
    const session = await authenticateSubPortal(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid or expired portal token' },
        { status: 401 }
      );
    }

    const db = createServerClient();

    const { data: docs, error } = await db
      .from('portal_sub_compliance_docs')
      .select('*')
      .eq('sub_id', session.sub_id)
      .eq('tenant_id', session.tenant_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Annotate each doc with expiration status
    const now = new Date();
    const annotated = (docs || []).map((doc: any) => {
      let expiration_status = 'valid';
      if (doc.expiry_date) {
        const expDate = new Date(doc.expiry_date);
        const daysUntilExpiry = Math.ceil(
          (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysUntilExpiry < 0) {
          expiration_status = 'expired';
        } else if (daysUntilExpiry <= 30) {
          expiration_status = 'expiring_soon';
        }
        return { ...doc, expiration_status, days_until_expiry: daysUntilExpiry };
      }
      return { ...doc, expiration_status, days_until_expiry: null };
    });

    return NextResponse.json({ compliance_docs: annotated });
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/** POST — Upload new compliance document (simulated upload, stores file_name/url) */
export async function POST(req: NextRequest) {
  try {
    const session = await authenticateSubPortal(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid or expired portal token' },
        { status: 401 }
      );
    }

    const db = createServerClient();
    const body = await req.json();
    const {
      doc_type,
      file_name,
      file_url,
      expires_at,
      policy_number,
      carrier,
      coverage_amount,
      notes,
    } = body;

    if (!doc_type || !file_name) {
      return NextResponse.json(
        { error: 'doc_type and file_name are required' },
        { status: 400 }
      );
    }

    // Live portal_sub_compliance_docs columns: tenant_id, sub_id, doc_type,
    // file_url, expiry_date, status, verified_at, created_at. There is no
    // project_id / file_name / policy_number / carrier / coverage_amount / notes
    // / uploaded_at column (and no jsonb to fold them into), so they are dropped.
    // expires_at -> expiry_date.
    const { data: doc, error } = await db
      .from('portal_sub_compliance_docs')
      .insert({
        sub_id: session.sub_id,
        tenant_id: session.tenant_id,
        doc_type,
        file_url: file_url || null,
        expiry_date: expires_at || null,
        status: 'pending_review',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(
      { compliance_doc: doc, message: 'Document uploaded successfully' },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
