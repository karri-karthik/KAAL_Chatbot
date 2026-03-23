export type PersonaType = 'consultant' | 'expert' | 'peer';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  intent?: string;
  meta?: 'nudge' | 'error';
}

export interface ChatRequest {
  message: string;
  sessionId: string;
  userName?: string;
  persona?: PersonaType;
  context: Array<{ role: 'user' | 'assistant'; content: string }>;
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

