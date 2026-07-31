import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions';
import Anthropic from '@anthropic-ai/sdk';

/**
 * POST /api/daily-logs/ai-fill  ->  { extracted: {...} }
 * Extracts structured daily-log fields from a spoken/voice transcript.
 * Body: { projectId, voiceTranscript, logDate }
 */
export async function POST(req: NextRequest) {
  const g = await requirePermission(req, 'Projects', 'Edit');
  if (!g.ok) return g.res;
  const user = g.user;

  const empty = {
    weather: '', high_temp: null as number | null, crew_count: null as number | null,
    work_performed: '', safety_notes: '', notes: '', visitors: '',
  };
  try {
    const body = await req.json().catch(() => ({}));
    const voiceTranscript: string = body.voiceTranscript ?? body.transcript ?? '';
    if (!String(voiceTranscript).trim()) {
      return NextResponse.json({ success: false, extracted: empty });
    }

    const client = new Anthropic();
    const prompt = `You are a construction superintendent's assistant. Extract structured daily-log fields from this spoken field report. If a field is not mentioned, use an empty string (or null for numbers). Do NOT invent data.

Spoken report: "${voiceTranscript}"

Respond ONLY with valid JSON in this exact format:
{
  "weather": "short description e.g. 'Sunny, light wind', or ''",
  "high_temp": <number or null>,
  "crew_count": <number or null>,
  "work_performed": "what was done today, 1-4 sentences",
  "safety_notes": "any safety observations, or ''",
  "notes": "any other notable items, or ''",
  "visitors": "site visitors mentioned, or ''"
}`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid AI response format');

    const extracted = { ...empty, ...JSON.parse(jsonMatch[0]) };
    return NextResponse.json({ success: true, extracted });
  } catch {
    // Return 200 with empty fields so the field app falls back to manual entry.
    console.error('[daily-logs/ai-fill] extraction failed');
    return NextResponse.json({ success: false, extracted: empty });
  }
}
