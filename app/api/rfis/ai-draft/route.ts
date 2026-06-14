import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase-server';
import Anthropic from '@anthropic-ai/sdk';

/**
 * POST /api/rfis/ai-draft  ->  { draft: { title, description } }
 * Turns a rough field note into a clear, professional RFI subject + question.
 * Body: { projectId, description }
 */
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const empty = { title: '', description: '' };
  try {
    const body = await req.json().catch(() => ({}));
    const description: string = body.description ?? '';
    if (!String(description).trim()) {
      return NextResponse.json({ success: false, error: 'No description provided', draft: empty });
    }

    const client = new Anthropic();
    const prompt = `You are a construction project engineer drafting a formal RFI (Request for Information) from a rough field note.

Rough note: "${description}"

Write a clear, professional RFI. Respond ONLY with valid JSON in this exact format:
{
  "title": "A concise RFI subject line (max ~10 words)",
  "description": "A clear, specific RFI question of 2-4 sentences that an architect or subcontractor can act on. Reference the relevant trade, location, or spec section where implied, and end with a specific question."
}`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid AI response format');

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ success: true, draft: { ...empty, ...parsed } });
  } catch {
    // Return 200 with an empty draft so the field app degrades gracefully.
    console.error('[rfis/ai-draft] generation failed');
    return NextResponse.json({ success: false, error: 'AI draft failed', draft: empty });
  }
}
