export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  intent?: string;
  meta?: 'nudge' | 'error';
}

export interface ChatResponse {
  reply: string;
  intent: string;
  requiresLead: boolean;
}

export interface LeadPayload {
  name: string;
  email: string;
  phone?: string;
  query?: string;
  sessionId: string;
  timestamp: string;
  sourceUrl: string;
}

