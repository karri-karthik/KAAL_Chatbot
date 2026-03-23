import React, { useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import kaalMascotSrc from '../icons/kaal-mascot-simple.svg?url';
import { LeadCaptureForm } from './LeadCaptureForm';
import { PersonaSelector, PERSONAS } from './PersonaSelector';
import type { ChatMessage, ChatResponse, PersonaType } from './types';

function KaalMascotAvatar({ size = 36 }: { size?: number }) {
  return (
    <img
      src={kaalMascotSrc}
      alt=""
      width={size}
      height={size}
      draggable={false}
      style={{
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        border: '1px solid rgba(148, 163, 184, 0.35)',
        background: 'rgba(15, 23, 42, 0.35)',
      }}
    />
  );
}

type Position = 'bottom-right' | 'bottom-left';

interface ChatWidgetProps {
  brandColor?: string;
  position?: Position;
  apiBaseUrl?: string;
}

const GREETING_DELAY_MS = 2000;
const INACTIVITY_NUDGE_MS = 30000;

/** Minimum time after the request starts before we begin revealing the reply (feels less “instant”). */
const ASSISTANT_REPLY_MIN_DELAY_MS = 900;
/** Base pause between each character when revealing the assistant reply. */
const TYPEWRITER_MS_PER_CHAR = 10;
/** Cap total typing time so very long replies do not take minutes. */
const MAX_TYPING_DURATION_MS = 16000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

const QUICK_OPTIONS = [
  { id: 'learn-features', label: 'What can Kaal do?', message: 'Tell me what Kaal Chatbot can do.' },
  { id: 'see-pricing', label: 'Pricing plans', message: 'What are your pricing plans?' },
  { id: 'book-demo', label: 'Book a demo', message: 'I want to book a live demo.' },
  { id: 'contact-team', label: 'Talk to the team', message: 'I want to talk to someone on your team.' },
];

export const ChatWidget: React.FC<ChatWidgetProps> = ({
  brandColor = '#1E3A5F',
  position = 'bottom-right',
  apiBaseUrl,
}) => {
  const [open, setOpen] = useState(false);
  const [renderWindow, setRenderWindow] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<PersonaType | null>(() => {
    // Check if persona was previously selected (persist across sessions)
    const stored = localStorage.getItem('kaal-selected-persona');
    return (stored as PersonaType) || null;
  });

  const [showLeadInline, setShowLeadInline] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [sessionId] = useState(() => {
    const existing = sessionStorage.getItem('kaal-chatbot-session-id');
    if (existing) return existing;
    const id = uuid();
    sessionStorage.setItem('kaal-chatbot-session-id', id);
    return id;
  });
  const [userName, setUserName] = useState<string | null>(() => {
    // Check if we have a stored name (persist across sessions with localStorage)
    const storedName = localStorage.getItem('kaal-user-name');
    return storedName;
  });
  const [isReturning, setIsReturning] = useState(() => {
    // Check if this is a returning visit (has visited before)
    // Use a persistent flag in localStorage to track if user has chatted before
    const hasVisitedBefore = localStorage.getItem('kaal-returning-flag');
    return hasVisitedBefore === 'true';
  });

  const inactivityTimer = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const baseUrl = useMemo(() => apiBaseUrl || import.meta.env.VITE_API_BASE_URL, [apiBaseUrl]);

  const openWindow = () => {
    if (renderWindow) {
      setOpen(true);
      return;
    }
    setRenderWindow(true);
    // let the DOM paint before animating to "open" state
    requestAnimationFrame(() => {
      setOpen(true);
    });
  };

  const closeWindow = () => {
    setOpen(false);
    window.setTimeout(() => {
      setRenderWindow(false);
    }, 220);
  };

  const handlePersonaSelect = (persona: PersonaType) => {
    setSelectedPersona(persona);
    localStorage.setItem('kaal-selected-persona', persona);
    // Send welcome message based on selected persona
    const personaInfo = PERSONAS.find(p => p.id === persona);
    if (personaInfo) {
      setMessages([
        {
          id: 'persona-intro',
          role: 'assistant',
          text: `You're now chatting with ${personaInfo.name}! ${personaInfo.longDescription} Feel free to ask me anything!`,
        },
      ]);
    }
  };

  useEffect(() => {
    // Only add greeting if persona is selected AND messages are empty AND we're past the delay
    const timer = window.setTimeout(() => {
      if (!selectedPersona) return;

      setMessages((current) => {
        if (current.length > 0) return current;

        // Get persona info for personalized greeting
        const persona = PERSONAS.find(p => p.id === selectedPersona);

        // Generate personalized greeting based on persona and returning status
        let greetingText: string;
        if (isReturning && userName) {
          const personaPrefix = persona ? `[${persona.name}] ` : '';
          const returningGreetings = [
            `${personaPrefix}Hey ${userName}! Welcome back! Still wrestling with assignments, or ready to enroll?`,
            `${personaPrefix}Yo ${userName}! Back for more? What's on your mind this time?`,
            `${personaPrefix}${userName}! Good to see you again. Ready to continue where we left off?`,
          ];
          greetingText = returningGreetings[Math.floor(Math.random() * returningGreetings.length)];
        } else if (userName) {
          greetingText = `${persona ? `[${persona.name}] ` : ''}Hey ${userName}! I'm Kaal. How can I help you today?`;
        } else {
          greetingText = `${persona ? `[${persona.name}] ` : ''}Hi! I'm Kaal, your AI assistant. What can I do for you?`;
        }

        return [
          {
            id: 'greeting',
            role: 'assistant',
            text: greetingText,
          },
        ];
      });
    }, GREETING_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [selectedPersona, userName, isReturning]);

  useEffect(() => {
    if (!open) return;
    if (inactivityTimer.current) {
      window.clearTimeout(inactivityTimer.current);
    }
    inactivityTimer.current = window.setTimeout(() => {
      setMessages((current) => {
        if (current.length === 0) {
          return current;
        }
        const alreadyNudged = current.some((m) => m.meta === 'nudge');
        if (alreadyNudged) return current;
        return [
          ...current,
          {
            id: 'nudge',
            role: 'assistant',
            text: 'Can I help you with anything?',
            meta: 'nudge',
          },
        ];
      });
    }, INACTIVITY_NUDGE_MS) as unknown as number;

    return () => {
      if (inactivityTimer.current) {
        window.clearTimeout(inactivityTimer.current);
      }
    };
  }, [open, messages.length]);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [messages, showLeadInline]);

  const sendMessage = async (rawContent: string) => {
    if (!rawContent.trim() || !baseUrl) return;
    const content = rawContent.trim();
    setShowLeadInline(false);

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      text: content,
    };
    const prevMessages = [...messages, userMessage];
    setMessages(prevMessages);

    // Save chat history for returning user detection (session-only, not persisted)
    try {
      const chatHistory = JSON.parse(sessionStorage.getItem('kaal-chat-history') || '[]');
      chatHistory.push({
        timestamp: new Date().toISOString(),
        role: 'user',
        content: content,
      });
      // Keep last 50 messages
      if (chatHistory.length > 50) {
        chatHistory.splice(0, chatHistory.length - 50);
      }
      sessionStorage.setItem('kaal-chat-history', JSON.stringify(chatHistory));
    } catch (e) {
      // Silently fail, non-critical
    }

    // Mark user as returning for future sessions (persisted)
    try {
      localStorage.setItem('kaal-returning-flag', 'true');
      setIsReturning(true);
    } catch (e) {
      // Silently fail if localStorage not available
    }

    // Try to extract name from user message if we don't have one yet
    if (!userName) {
      const nameMatch = content.match(/(?:my name is|i'm|i am|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
      if (nameMatch) {
        const extractedName = nameMatch[1];
        setUserName(extractedName);
        try {
          localStorage.setItem('kaal-user-name', extractedName);
        } catch (e) {
          // Silently fail if localStorage not available
        }
      }
    }

    try {
      setLoading(true);
      const requestStartedAt = performance.now();
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          sessionId,
          userName: userName || undefined,
          persona: selectedPersona || undefined,
          context: prevMessages.map((m) => ({ role: m.role, content: m.text })),
        }),
      });

      if (!res.ok) {
        throw new Error('Chat API error');
      }

      const data = (await res.json()) as ChatResponse;
      const assistantId = `${Date.now()}-assistant`;

      setMessages((current) => [
        ...current,
        {
          id: assistantId,
          role: 'assistant',
          text: '',
          intent: data.intent,
        },
      ]);

      const elapsed = performance.now() - requestStartedAt;
      await sleep(Math.max(0, ASSISTANT_REPLY_MIN_DELAY_MS - elapsed));

      const fullReply = data.reply;
      const estimatedTyping = fullReply.length * TYPEWRITER_MS_PER_CHAR;
      const msPerChar =
        estimatedTyping > MAX_TYPING_DURATION_MS
          ? MAX_TYPING_DURATION_MS / Math.max(1, fullReply.length)
          : TYPEWRITER_MS_PER_CHAR;

      for (let i = 1; i <= fullReply.length; i++) {
        const slice = fullReply.slice(0, i);
        setMessages((current) =>
          current.map((m) => (m.id === assistantId ? { ...m, text: slice } : m)),
        );
        await sleep(msPerChar);
      }
    } catch (e) {
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-error`,
          role: 'assistant',
          text: 'Sorry, I am having trouble connecting. Please try again.',
          meta: 'error',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const content = input.trim();
    setInput('');
    await sendMessage(content);
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const alignmentStyle: React.CSSProperties =
    position === 'bottom-right'
      ? { right: '1.5rem', bottom: '1.5rem' }
      : { left: '1.5rem', bottom: '1.5rem' };

  return (
    <>
      {renderWindow && (
        <div
          style={{
            position: 'fixed',
            ...alignmentStyle,
            width: '420px',
            maxWidth: '100vw',
            height: selectedPersona ? '560px' : '640px', // taller for persona selection
            maxHeight: '80vh',
            borderRadius: '24px',
            boxShadow: '0 24px 60px rgba(15, 23, 42, 0.45)',
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 2147483000,
            transform: open ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.96)',
            opacity: open ? 1 : 0,
            transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
          }}
        >
          {!selectedPersona ? (
            // Persona Selection Screen
            <>
              <div
                style={{
                  flexShrink: 0,
                  position: 'relative',
                  zIndex: 2,
                  padding: '0.75rem 0.85rem 0.75rem 1rem',
                  borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  minHeight: '56px',
                  background: 'linear-gradient(135deg, #0f172a, #020617)',
                  color: '#f9fafb',
                }}
              >
                <KaalMascotAvatar size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '0.92rem',
                      fontWeight: 600,
                      lineHeight: 1.25,
                      wordBreak: 'break-word',
                    }}
                  >
                    Choose your persona
                  </div>
                  <div style={{ fontSize: '0.68rem', opacity: 0.78, marginTop: '0.15rem', lineHeight: 1.3 }}>
                    Step 1 of 2
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeWindow}
                  aria-label="Close chat"
                  style={{
                    flexShrink: 0,
                    alignSelf: 'flex-start',
                    borderRadius: '999px',
                    border: '1px solid rgba(148, 163, 184, 0.4)',
                    padding: '0.3rem 0.55rem',
                    fontSize: '0.8rem',
                    lineHeight: 1,
                    background: 'transparent',
                    color: '#e5e7eb',
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <PersonaSelector onSelect={handlePersonaSelect} brandColor={brandColor} />
              </div>
            </>
          ) : (
            // Chat Interface
            <>
              <div
                style={{
                  padding: '0.65rem 0.75rem 0.65rem 0.9rem',
                  borderBottom: '1px solid rgba(148, 163, 184, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  minHeight: '56px',
                  background: 'linear-gradient(135deg, #0f172a, #020617)',
                  color: '#f9fafb',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0, flex: 1 }}>
                  <KaalMascotAvatar size={38} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        lineHeight: 1.25,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={
                        selectedPersona
                          ? `Kaal · ${PERSONAS.find((p) => p.id === selectedPersona)?.name ?? ''}`
                          : 'Kaal'
                      }
                    >
                      Kaal
                      {selectedPersona
                        ? ` · ${PERSONAS.find((p) => p.id === selectedPersona)?.name ?? ''}`
                        : ''}
                    </div>
                    <div
                      style={{
                        fontSize: '0.68rem',
                        opacity: 0.8,
                        lineHeight: 1.25,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={PERSONAS.find((p) => p.id === selectedPersona)?.shortDescription || ''}
                    >
                      {PERSONAS.find((p) => p.id === selectedPersona)?.shortDescription || ''}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPersona(null);
                      localStorage.removeItem('kaal-selected-persona');
                      setMessages([]);
                    }}
                    style={{
                      borderRadius: '999px',
                      border: '1px solid rgba(148, 163, 184, 0.4)',
                      padding: '0.25rem 0.6rem',
                      fontSize: '0.7rem',
                      background: 'rgba(15, 23, 42, 0.3)',
                      color: '#e5e7eb',
                      cursor: 'pointer',
                    }}
                    title="Change persona"
                  >
                    ↻ Change
                  </button>
                  <button
                    type="button"
                    onClick={closeWindow}
                    aria-label="Close chat"
                    style={{
                      borderRadius: '999px',
                      border: '1px solid rgba(148, 163, 184, 0.4)',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      background: 'transparent',
                      color: '#e5e7eb',
                      cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div
                ref={containerRef}
                style={{
                  flex: 1,
                  padding: '1rem',
                  background:
                    'radial-gradient(circle at top, rgba(226, 232, 240, 0.8), transparent 55%), #f9fafb',
                  overflowY: 'auto',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {messages.map((m, index) => (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          maxWidth: '80%',
                          borderRadius:
                            m.role === 'user' ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
                          padding: '0.7rem 0.9rem',
                          fontSize: '0.85rem',
                          lineHeight: 1.4,
                          backgroundColor: m.role === 'user' ? brandColor : '#ffffff',
                          color: m.role === 'user' ? '#f9fafb' : '#0f172a',
                          boxShadow:
                            m.role === 'user'
                              ? '0 10px 25px rgba(15, 23, 42, 0.35)'
                              : '0 8px 18px rgba(15, 23, 42, 0.12)',
                          animation:
                            m.role === 'user'
                              ? 'chat-bubble-in-right 0.18s ease-out both'
                              : 'chat-bubble-in-left 0.18s ease-out both',
                          animationDelay: `${index * 20}ms`,
                        }}
                      >
                        {m.text}
                      </div>
                    </div>
                  ))}
                </div>
                {!leadCaptured && messages.length > 0 && (
                  <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {QUICK_OPTIONS.map((option, index) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          void sendMessage(option.message);
                          if (option.id === 'book-demo' && !leadCaptured) {
                            window.setTimeout(() => setShowLeadInline(true), 1800);
                          }
                        }}
                        style={{
                          borderRadius: '999px',
                          border: '1px solid rgba(148, 163, 184, 0.9)',
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.78rem',
                          backgroundColor: '#ffffff',
                          cursor: 'pointer',
                          animation: 'chat-chip-in 0.2s ease-out both',
                          animationDelay: `${index * 40}ms`,
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}

                {showLeadInline && !leadCaptured && (
                  <div style={{ marginTop: '0.9rem' }}>
                    <LeadCaptureForm
                      sessionId={sessionId}
                      apiBaseUrl={baseUrl}
                      onSubmitted={() => {
                        setLeadCaptured(true);
                        setShowLeadInline(false);
                      }}
                    />
                  </div>
                )}
              </div>

              <div
                style={{
                  padding: '0.75rem 0.75rem 0.85rem',
                  borderTop: '1px solid rgba(148, 163, 184, 0.35)',
                  background: '#ffffff',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    alignItems: 'center',
                  }}
                >
                  <input
                    type="text"
                    placeholder={`Ask ${selectedPersona === 'consultant' ? 'the consultant' : selectedPersona === 'expert' ? 'the expert' : 'your peer'}...`}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleKeyDown}
                    style={{
                      flex: 1,
                      borderRadius: '999px',
                      border: '1px solid rgba(148, 163, 184, 0.7)',
                      padding: '0.55rem 0.9rem',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={loading || !input.trim()}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '999px',
                      border: 'none',
                      background: brandColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#f9fafb',
                      cursor: loading ? 'wait' : 'pointer',
                      opacity: loading || !input.trim() ? 0.6 : 1,
                    }}
                  >
                    ▶
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {!open && (
        <button
          type="button"
          className="kaal-chat-launcher"
          onClick={openWindow}
          style={{
            position: 'fixed',
            ...alignmentStyle,
            padding: 0,
            margin: 0,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            zIndex: 2147483000,
            lineHeight: 0,
          }}
          aria-label="Open chat"
        >
          <img
            src={kaalMascotSrc}
            alt=""
            width={72}
            height={72}
            draggable={false}
            style={{
              display: 'block',
              width: 72,
              height: 72,
              objectFit: 'contain',
            }}
          />
        </button>
      )}
    </>
  );
};

