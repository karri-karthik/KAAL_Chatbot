import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';
import fs from 'node:fs/promises';

const knowledgeBase = JSON.parse(
  await fs.readFile(new URL('../src/data/knowledge-base.json', import.meta.url), 'utf8'),
);

const app = express();
const port = process.env.PORT || 4000;

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) || '*',
  }),
);
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

function matchIntent(message) {
  const text = message.toLowerCase().trim();

  // Score each intent by how many tags match – pick the best
  let bestIntent = null;
  let bestScore = 0;

  for (const intent of knowledgeBase.intents) {
    let score = 0;
    for (const tag of intent.tags) {
      const lowerTag = tag.toLowerCase();
      // Multi-word tags use substring matching; single-word tags use word boundaries
      if (lowerTag.includes(' ')) {
        if (text.includes(lowerTag)) score += 2; // multi-word is more specific
      } else {
        const regex = new RegExp(`\\b${lowerTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(text)) score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  }

  return bestIntent;
}

function requiresLeadFromIntent(intentId) {
  if (!intentId) return false;
  return intentId === 'demo_request';
}

app.post('/api/chat', async (req, res) => {
  const { message, sessionId, context } = req.body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }

  let reply = '';
  let intentId = '';

  const matched = matchIntent(message);

  if (matched) {
    reply = matched.answer;
    intentId = matched.id;
  } else if (openai) {
    try {
      const systemPrompt = [
        'You are Kaal, a friendly and knowledgeable AI assistant for the Kaal Chatbot product.',
        'Answer questions using the provided FAQ knowledge base when possible.',
        'Keep answers concise, helpful, and conversational.',
        'If you are not sure, say so and suggest the user reach out to the team.',
        'When discussing pricing, demos, or sales, let the user know they can share their contact details for follow-up.',
        'Use a warm, professional tone. You may use occasional emojis sparingly.',
      ].join(' ');

      const kbText = knowledgeBase.intents
        .map((i) => `Q: ${i.question}\nA: ${i.answer}`)
        .join('\n\n');

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'system',
            content: `Here is the knowledge base:\n${kbText}`,
          },
          ...(Array.isArray(context) ? context : []).map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
          })),
          { role: 'user', content: message },
        ],
      });

      reply =
        completion.choices[0]?.message?.content?.trim() ||
        knowledgeBase.fallback ||
        'I am not sure about that. Let me connect you to our team.';
      intentId = 'llm_answer';
    } catch (error) {
      console.error('OpenAI error', error);
      reply =
        knowledgeBase.fallback ||
        'I am not sure about that. Let me connect you to our team.';
      intentId = 'fallback';
    }
  } else {
    reply =
      knowledgeBase.fallback ||
      'I am not sure about that. Let me connect you to our team.';
    intentId = 'fallback';
  }

  const requiresLead = requiresLeadFromIntent(intentId);

  return res.json({
    reply,
    intent: intentId,
    requiresLead,
    sessionId: sessionId || null,
  });
});

app.post('/api/leads', async (req, res) => {
  const { name, email, phone, query, sessionId, timestamp, sourceUrl } = req.body || {};

  if (!name || !email) {
    return res.status(400).json({ error: 'Validation failed', fields: ['name', 'email'] });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Lead storage is not configured' });
  }

  try {
    const { data, error } = await supabase
      .from('leads')
      .insert([
        {
          name,
          email,
          phone: phone || null,
          query: query || null,
          session_id: sessionId || null,
          source_url: sourceUrl || null,
          created_at: timestamp || new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase error', error);
      return res.status(500).json({ error: 'Lead insert failed' });
    }

    return res.status(201).json({ success: true, leadId: data.id });
  } catch (error) {
    console.error('Lead insert error', error);
    return res.status(500).json({ error: 'Lead insert failed' });
  }
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Kaal Chatbot API listening on port ${port}`);
});

