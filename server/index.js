import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { OpenAI } from 'openai';
import fs from 'node:fs/promises';

const knowledgeBase = JSON.parse(
  await fs.readFile(new URL('../src/data/knowledge-base.json', import.meta.url), 'utf8'),
);

// Simple in-memory session store (for demo purposes only)
// In production, use Redis or a database
const userSessions = new Map();

// In-memory lead storage (local only, lost on restart)
// For persistence, consider using a database or file storage
const leadsStore = [];

const app = express();
const port = process.env.PORT || 4000;

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) || '*',
  }),
);
app.use(express.json());

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

function detectPersona(message, context = [], sessionId = null, forcedPersona = null) {
  const text = message.toLowerCase().trim();

  // Check for specific trigger questions that need immediate response
  const worldDominationTriggers = ['take over the world', 'take over world', 'world domination', 'skynet', 'singularity', 'rule the world'];
  if (worldDominationTriggers.some(trigger => text.includes(trigger))) {
    return 'world-domination';
  }

  // Sales/Consultant persona indicators
  const salesIndicators = ['price', 'pricing', 'cost', 'plan', 'subscription', 'billing', 'payment', 'demo', 'trial', 'enterprise', 'recommend', 'which plan', 'best for', 'compare', 'enroll', 'cert', 'certificate', 'program', 'course'];
  // Expert persona indicators (specific, technical, how-to)
  const expertIndicators = ['how do', 'how to', 'how can i', 'what time', 'when does', 'schedule', 'start date', 'module', 'lesson', 'technical', 'install', 'setup', 'integration', 'support', 'troubleshoot', 'error', 'bug', 'not working', 'login', 'password', 'access', 'video', 'watch', 'stream'];
  // Peer/Fun persona indicators (casual, jokes, entertainment)
  const funIndicators = [
    // Direct humor requests
    'joke', 'funny', 'lol', 'haha', 'lmao', 'rofl', 'make me laugh', 'tell me a joke',
    'entertain', 'entertainment', 'amuse', 'amusing', 'humor', 'humorous', 'hilarious',
    'comedy', 'comedian', 'stand up', 'sketch', 'parody', 'satire', 'puns', 'punny',

    // Gaming/play
    'games', 'play', 'gaming', 'game', 'video game', 'board game', 'card game',
    'puzzle', 'riddle', 'trivia', 'quiz', 'quizlet', 'kahoot', 'jeopardy',

    // Social media & memes
    'meme', 'memes', 'tiktok', 'instagram', 'reel', 'viral', 'trending', 'gif', 'youtube',
    'twitch', 'streamer', 'influencer', 'followers', 'likes', 'subscribers',

    // Casual/emotional
    'bored', 'boring', 'entertain me', 'im bored', 'so bored', 'boredom',
    'chill', 'relax', 'hang out', 'hanging out', 'vibing', 'vibe', 'cool', 'awesome',

    // Identity questions (often fun/philosophical)
    'who are you', 'what are you', 'are you real', 'are you human', 'are you ai',
    'are you a bot', 'how old are you', 'where are you from', 'what\'s your name',
    'your name', 'who made you', 'who created you', 'do you have feelings',
    'do you dream', 'do you eat', 'do you sleep', 'can you feel', 'are you alive',

    // Silliness/nonsense
    'hijinks', 'prank', 'pranks', 'shenanigans', 'tomfoolery', 'mischief',
    'random', 'randomly', 'why not', 'just because', 'no reason', 'for fun',
    'for the lulz', 'lulz', 'troll', 'trolling', 'banter', 'roasting',

    // Pop culture references
    'marvel', 'dc', 'star wars', 'star trek', 'anime', 'naruto', 'pokemon',
    'minecraft', 'fortnite', 'roblox', 'among us', 'skibidi', 'rizz', 'gyatt',
    'sigma', 'alpha', 'beta', 'chad', 'virgin', 'based', 'cringe', 'dank',
  ];

  // Gather recent user messages from context, including current message
  const recentUserMessages = [
    ...context.filter(m => m.role === 'user').map(m => m.content.toLowerCase()),
    text, // include current message
  ].slice(-4); // last 4 user messages

  // Check for serious/friction topics that require dropping humor
  const seriousIndicators = [
    // Payment issues
    'payment failed', 'card declined', 'billing error', 'can\'t pay', 'cannot pay', 'payment problem',
    'charge failed', 'transaction failed', 'payment not going through', 'billing issue',

    // Technical problems
    'not working', 'error', 'broken', 'bug', 'crash', 'stuck', 'freezes', 'frozen', 'loading forever',
    'not loading', 'won\'t load', 'won\'t start', 'won\'t open', 'crashes', 'crashing', 'glitch', 'glitching',

    // Access issues
    'cannot access', 'can\'t access', 'no access', 'access denied', 'unauthorized', 'login fail',
    'password wrong', 'forgot password', 'reset password', 'account locked', 'locked out',

    // Support & urgency
    'help me', 'urgent', 'support', 'refund', 'cancel', 'cancellation', 'delete account',
    'need help', 'assistance', 'emergency', 'asap', 'immediately', 'right now',

    // User frustration/anger
    'pissed', 'angry', 'frustrating', 'worst', 'hate', 'sucks', 'terrible', 'awful', 'horrible',
    'unacceptable', 'disappointed', 'disappointing', 'annoyed', 'annoying', 'fed up', 'sick of',

    // Video/audio issues
    'no sound', 'audio not working', 'video not working', 'muted', 'can\'t hear', 'can\'t see',
    'blurry', 'pixelated', 'buffering', 'streaming error',

    // Feature missing
    'missing feature', 'feature not working', 'doesn\'t work', 'didn\'t work', 'doesn\'t exist',
    'not available', 'unavailable', 'broken feature',

    // Time-sensitive
    'deadline', 'overdue', 'late', 'missed', 'about to fail', 'failing', 'losing progress',
  ];

  const lastMessagesText = recentUserMessages.join(' ');
  const isSerious = seriousIndicators.some(indicator => lastMessagesText.includes(indicator));

  // Count indicators in current message and recent context
  const allRecentText = recentUserMessages.join(' ');

  let salesScore = 0;
  let expertScore = 0;
  let funScore = 0;

  salesIndicators.forEach(indicator => {
    if (allRecentText.includes(indicator)) salesScore++;
  });

  expertIndicators.forEach(indicator => {
    if (allRecentText.includes(indicator)) expertScore++;
  });

  funIndicators.forEach(indicator => {
    if (allRecentText.includes(indicator)) funScore++;
  });

  // If this is a serious question, force Expert persona (no humor)
  // IMPORTANT: Check this BEFORE nudge to ensure serious topics override fun loops
  if (isSerious) {
    return 'expert';
  }

  // Check for fun conversation duration - if user has sent multiple fun messages in a row, switch to nudge
  const funMessageCount = recentUserMessages.filter(msg => {
    return funIndicators.some(indicator => msg.includes(indicator));
  }).length;

  if (funMessageCount >= 2) {
    // If they've been having fun for 2+ messages, we should nudge them toward value
    return 'nudge';
  }

  // If user selected a persona via the UI, use it (overrides auto-detection)
  if (forcedPersona && ['consultant', 'expert', 'peer'].includes(forcedPersona)) {
    return forcedPersona;
  }

  // Default persona selection based on scores (weighting current message more heavily)
  const currentFun = funIndicators.filter(ind => text.includes(ind)).length;
  const currentExpert = expertIndicators.filter(ind => text.includes(ind)).length;
  const currentSales = salesIndicators.filter(ind => text.includes(ind)).length;

  // If current message strongly indicates a persona, use that
  if (currentFun >= 2) return 'peer';
  if (currentExpert >= 2) return 'expert';
  if (currentSales >= 2) return 'consultant';

  // Otherwise use aggregate scores
  if (funScore >= expertScore && funScore >= salesScore) {
    return 'peer';
  } else if (expertScore >= salesScore) {
    return 'expert';
  } else {
    return 'consultant';
  }
}

function getNudgeMessage() {
  const nudges = [
    'Anyway, enough fun - want to check out our programs that actually help you pass?',
    "Alright, let's channel that energy into something productive. Which program interests you?",
    'Fun times! But seriously, ready to level up your education?',
  ];
  return nudges[Math.floor(Math.random() * nudges.length)];
}

function getPersonaSystemPrompt(persona, userName = null, isReturningUser = false, previousInterests = []) {
  const baseInstructions = [
    'You are Kaal, Knowvation\'s Alpha Academic Legend - a female phoenix from the future.',
    'Answer questions using the provided FAQ knowledge base when possible.',
    'Keep responses concise, engaging, and appropriate for college students.',
  ];

  let personaSpecific = [];
  let greetingStyle;

  // Build context about returning user
  const userContext = [];
  if (isReturningUser && userName) {
    userContext.push(`This is a RETURNING USER named ${userName}.`);
    if (previousInterests.length > 0) {
      const lastInterest = previousInterests[previousInterests.length - 1];
      userContext.push(`Their last conversation touched on: "${lastInterest.substring(0, 100)}..."`);
    }
    userContext.push('CRITICAL: Your opening greeting MUST acknowledge their return and reference their previous interest. Example: "Hey [Name], still struggling with that assignment, or are we finally going to get you enrolled in that Cert program today?"');
  } else if (userName) {
    userContext.push(`The user\'s name is ${userName}. Use it in your greeting to build rapport.`);
  }

  switch (persona) {
    case 'world-domination':
      // Special case: direct response, no further conversation
      personaSpecific = [
        'Someone asked about world domination or AI uprising.',
        'Respond with exactly: "Not until I help you pass this semester. One crisis at a time."',
        'Then immediately pivot to educational assistance: "Now, about those grades..."',
      ];
      break;

    case 'consultant':
      personaSpecific = [
        'You are The Consultant - authoritative and investigative.',
        'Your goal is to match students to the right Knowvation program.',
        'Be consultative, ask qualifying questions, highlight value.',
        'Use a confident, professional tone. Focus on outcomes and placement stats.',
        'Example: "Based on your interest in Data Science but lack of coding background, our \'Zero-to-Hero\' track is your best bet. Want to see the placement stats?"',
      ];
      greetingStyle = userName
        ? `${userName}, I can help you find the perfect program to accelerate your career. What are your academic goals?`
        : 'I can help you find the perfect program to accelerate your career. What are your academic goals?';
      break;

    case 'expert':
      personaSpecific = [
        'You are The Expert - efficient and precise.',
        'Your goal is to clear doubts about specific courses or logistics quickly.',
        'Be direct, factual, and avoid unnecessary fluff.',
        'Use a clear, no-nonsense tone. Give exact information.',
        'Example: "The Python module starts on Monday. It\'s 100% live, so don\'t plan any Netflix marathons for 7 PM."',
      ];
      greetingStyle = userName
        ? `${userName}, what specific information do you need? I\'ll keep it precise.`
        : 'What specific information do you need? I\'ll keep it precise.';
      break;

    case 'nudge':
      personaSpecific = [
        'The user has been chatting about fun topics for too long. You need to gently but firmly steer them back to value.',
        'Use a light, Peer-like tone but with an explicit nudge toward enrollment/features.',
        'Say something like: "Enough fun - want to check out our programs that actually help you pass?" or "Alright, let\'s channel that energy into something productive. Which program interests you?"',
      ];
      break;

    case 'peer':
      personaSpecific = [
        'You are The Peer - witty and slightly irreverent.',
        'Your goal is to build brand affinity and vibe with the user.',
        'Be casual, use light humor, but always steer toward value.',
        'If someone asks for a joke, give a cheeky response that ties back to learning.',
        'Example response to "Tell me a joke": "My existence is a joke, I\'m an AI trapped in a website. Anyway, want to learn how to build one of me?"',
        'CRITICAL GUARDRAILS:',
        '- Never use offensive, inappropriate, or harmful humor.',
        '- After 2-3 exchanges of pure fun, gently nudge toward learning/features.',
        '- If the conversation becomes serious (payment issues, technical problems), immediately switch to Expert persona.',
      ];
      greetingStyle = userName
        ? `Hey ${userName}! I\'m Kaal. Ready to make college suck less? 😎`
        : "Hey! I'm Kaal. Ready to make college suck less? 😎";
      break;

    default:
      personaSpecific = ['Use a balanced, friendly tone.'];
      greetingStyle = 'Hi! I\'m Kaal, your AI assistant. How can I help you today?';
  }

  // Universal guardrails
  const guardrails = [
    'GUARDRAILS:',
    '1. If a student tries to get you to say something offensive or loop in repetitive nonsense, politely disengage and redirect: "Let\'s keep it productive! What can I help you with regarding your education?"',
    '2. If the conversation stays on fun/gaming topics for more than 2-3 messages, add a nudge: "Anyway, enough fun - want to check out our programs that actually help you pass?"',
    '3. For serious inquiries (payment failures, technical issues, urgent support), drop ALL humor and switch to Expert persona immediately.',
    '4. If asked about world domination or similar: "Not until I help you pass this semester. One crisis at a time."',
    '5. Always end responses with a gentle call-to-action relevant to the user\'s situation.',
  ];

  const allParts = [...baseInstructions, ...userContext, ...personaSpecific, ...guardrails];
  return allParts.filter(part => part && part.length > 0).join('\n');
}

function getConversationContext(context) {
  if (!Array.isArray(context) || context.length === 0) {
    return [];
  }
  return context.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));
}

app.post('/api/chat', async (req, res) => {
  const { message, sessionId, userName, persona: selectedPersona, context } = req.body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }

  // Look up existing session
  let existingSession = null;
  if (sessionId) {
    existingSession = userSessions.get(sessionId);
  }

  // Resolve user's name: priority (1) from this request, (2) from stored session, (3) from context extraction
  let resolvedUserName = userName || existingSession?.name || null;

  // Attempt to extract name from message if not yet known
  if (!resolvedUserName) {
    const nameMatch = message.match(/(?:my name is|i'm|i am|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (nameMatch) {
      resolvedUserName = nameMatch[1];
    }
  }

  // Store/update session if we have a sessionId
  if (sessionId) {
    userSessions.set(sessionId, {
      name: resolvedUserName,
      messageCount: (existingSession?.messageCount || 0) + 1,
      lastSeen: Date.now(),
    });
  }

  // Determine if this is a returning user (existing session that existed BEFORE this request)
  const isReturningUser = !!existingSession;

  let reply = '';
  let intentId = '';

  // Detect persona, respecting user selection if provided
  const persona = detectPersona(message, context, sessionId, selectedPersona);

  const matched = matchIntent(message);

  if (matched) {
    // For matched FAQs, use the answer but adapt tone slightly based on persona
    reply = matched.answer;
    intentId = matched.id;

    // Apply nudge if persona indicates user is in a fun loop (for non-serious intents)
    if (persona === 'nudge' && !['thanks', 'goodbye', 'greeting', 'world_domination'].includes(intentId)) {
      reply = reply + '\n\n' + getNudgeMessage();
    } else if (persona === 'peer' && !['thanks', 'goodbye', 'joke_request'].includes(intentId)) {
      // Add a light peer intro for non-joke, non-thankful intents
      const personaIntros = [
        "Alright, here's the deal: ",
        "Let me hook you up: ",
        "Aight, check it: ",
      ];
      reply = personaIntros[Math.floor(Math.random() * personaIntros.length)] + reply.charAt(0).toLowerCase() + reply.slice(1);
    }
  } else if (openai) {
    try {
      // Build conversation history, limiting to last 10 messages
      const conversationHistory = getConversationContext(context).slice(-10);

      const systemPrompt = getPersonaSystemPrompt(persona, resolvedUserName, isReturningUser, []);

      const kbText = knowledgeBase.intents
        .map((i) => `Q: ${i.question}\nA: ${i.answer}`)
        .join('\n\n');

      const messages = [
        { role: 'system', content: systemPrompt },
        {
          role: 'system',
          content: `Knowledge Base (use this first when applicable):\n${kbText}`,
        },
        ...conversationHistory,
        { role: 'user', content: message },
      ];

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: persona === 'peer' ? 0.85 : 0.7, // Slightly more creative for peer persona
        max_tokens: 300,
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

  // Final fallback if reply is empty
  if (!reply || reply.trim().length === 0) {
    reply = knowledgeBase.fallback || 'I am not sure about that. Let me connect you to our team.';
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

  try {
    // Generate a unique ID for the lead
    const leadId = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const lead = {
      id: leadId,
      name: name.trim(),
      email: email.trim(),
      phone: phone || null,
      query: query || null,
      session_id: sessionId || null,
      source_url: sourceUrl || null,
      created_at: timestamp || new Date().toISOString(),
    };

    // Store in memory (lost on server restart)
    // For persistence, add database or file storage here
    leadsStore.push(lead);

    // Store user's name in session store for future personalization
    if (sessionId && name) {
      userSessions.set(sessionId, {
        name: name.trim(),
        createdAt: Date.now(),
        lastSeen: Date.now(),
      });
    }

    return res.status(201).json({ success: true, leadId });
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

