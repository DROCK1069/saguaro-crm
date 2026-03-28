import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getPortalSession, PORTAL_PERMS } from '@/lib/portal-auth';

/** GET — list AI summaries for project */
export async function GET(req: NextRequest) {
  try {
    const session = await getPortalSession(req, PORTAL_PERMS.VIEW_PROJECT);
    if (!session) {
      return NextResponse.json({ error: 'Access denied — insufficient permissions' }, { status: 403 });
    }

    const db = createServerClient();
    const { data: summaries, error } = await db
      .from('portal_summaries')
      .select('*')
      .eq('project_id', session.project_id)
      .eq('tenant_id', session.tenant_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ summaries: summaries || [] });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST — generate a new summary from daily logs */
export async function POST(req: NextRequest) {
  try {
    const session = await getPortalSession(req, PORTAL_PERMS.VIEW_PROJECT);
    if (!session) {
      return NextResponse.json({ error: 'Access denied — insufficient permissions' }, { status: 403 });
    }

    const body = await req.json();
    const { period_start, period_end } = body;

    const db = createServerClient();
    const projectId = session.project_id;
    const tenantId = session.tenant_id;

    // Collect daily log data for the period
    let logsQuery = db
      .from('daily_logs')
      .select('*')
      .eq('project_id', projectId)
      .eq('tenant_id', tenantId)
      .order('log_date', { ascending: true });

    if (period_start) {
      logsQuery = logsQuery.gte('log_date', period_start);
    }
    if (period_end) {
      logsQuery = logsQuery.lte('log_date', period_end);
    }

    const { data: logs, error: logsError } = await logsQuery;
    if (logsError) throw logsError;

    // Build structured summary from collected data
    const logEntries = logs || [];
    const totalLogs = logEntries.length;
    const weatherDays = logEntries.filter((l: any) => l.weather_delay).length;
    const workforceTotal = logEntries.reduce(
      (sum: number, l: any) => sum + (l.workforce_count || 0),
      0
    );

    const structuredSummary = {
      period: {
        start: period_start || (logEntries[0]?.log_date ?? null),
        end: period_end || (logEntries[logEntries.length - 1]?.log_date ?? null),
      },
      stats: {
        total_log_days: totalLogs,
        weather_delay_days: weatherDays,
        avg_workforce: totalLogs > 0 ? Math.round(workforceTotal / totalLogs) : 0,
      },
      activities: logEntries.map((l: any) => ({
        date: l.log_date,
        description: l.work_description || l.notes || '',
        workforce: l.workforce_count || 0,
        weather: l.weather || '',
      })),
      highlights: logEntries
        .filter((l: any) => l.milestones || l.highlights)
        .map((l: any) => ({
          date: l.log_date,
          note: l.milestones || l.highlights,
        })),
      ai_narrative: '',
    };

    // Generate AI narrative summary via Claude
    if (process.env.ANTHROPIC_API_KEY && logEntries.length > 0) {
      try {
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        const logContext = logEntries.slice(0, 20).map((l: any) =>
          `${l.log_date}: ${l.work_description || l.notes || 'No notes'}${l.weather ? ` (Weather: ${l.weather})` : ''}${l.weather_delay ? ' [WEATHER DELAY]' : ''}`
        ).join('\n');

        const msg = await client.messages.create({
          model: 'claude-haiku-4-20250514',
          max_tokens: 600,
          system: 'You are a construction project manager writing a weekly progress summary for a building owner. Be concise, professional, and factual. Use bullet points for key items. Mention weather delays, milestones, and any concerns.',
          messages: [{
            role: 'user',
            content: `Write a brief owner-facing project summary for this period.\n\nDaily logs:\n${logContext}\n\nStats: ${totalLogs} work days, ${weatherDays} weather delays, avg ${structuredSummary.stats.avg_workforce} workers/day.\n\nWrite 3-5 bullet points summarizing progress, any concerns, and next steps.`
          }],
        });

        const aiText = msg.content?.[0]?.type === 'text' ? msg.content[0].text : '';
        structuredSummary.ai_narrative = aiText;
      } catch (err) {
        console.warn('[portal/summary] AI generation failed (non-fatal):', err);
      }
    }

    // Store the generated summary
    const { data: saved, error: saveError } = await db
      .from('portal_summaries')
      .insert({
        project_id: projectId,
        tenant_id: tenantId,
        period_start: structuredSummary.period.start,
        period_end: structuredSummary.period.end,
        summary_data: structuredSummary,
        generated_by: 'system',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (saveError) throw saveError;

    return NextResponse.json({ summary: saved });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
