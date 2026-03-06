import React, { useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { LeadCaptureForm } from './LeadCaptureForm';
import type { ChatMessage, ChatResponse } from './types';

type Position = 'bottom-right' | 'bottom-left';

interface ChatWidgetProps {
  brandColor?: string;
  position?: Position;
  apiBaseUrl?: string;
}

const GREETING_DELAY_MS = 2000;
const INACTIVITY_NUDGE_MS = 30000;

const QUICK_OPTIONS = [
  { id: 'learn-features', label: 'Explore what you can do', message: 'Tell me what this chatbot can do.' },
  { id: 'see-pricing', label: 'Understand pricing', message: 'I would like to understand pricing.' },
  { id: 'book-demo', label: 'Book a live demo', message: 'I want to book a live demo.' },
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
  const [requiresLead, setRequiresLead] = useState(false);
  const [showLeadInline, setShowLeadInline] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [sessionId] = useState(() => {
    const existing = sessionStorage.getItem('ai-chatbot-session-id');
    if (existing) return existing;
    const id = uuid();
    sessionStorage.setItem('ai-chatbot-session-id', id);
    return id;
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMessages((current) => {
        if (current.length > 0) return current;
        return [
          {
            id: 'greeting',
            role: 'assistant',
            text: 'Hi there! How can I help you today?',
          },
        ];
      });
    }, GREETING_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

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
  }, [messages, requiresLead, showLeadInline]);

  const sendMessage = async (rawContent: string, opts?: { openLeadAfter?: boolean }) => {
    if (!rawContent.trim() || !baseUrl) return;
    const content = rawContent.trim();
    setRequiresLead(false);
    if (!opts?.openLeadAfter) {
      setShowLeadInline(false);
    }

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      text: content,
    };
    const prevMessages = [...messages, userMessage];
    setMessages(prevMessages);

    try {
      setLoading(true);
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          sessionId,
          context: prevMessages.map((m) => ({ role: m.role, content: m.text })),
        }),
      });

      if (!res.ok) {
        throw new Error('Chat API error');
      }

      const data = (await res.json()) as ChatResponse;

      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-assistant`,
          role: 'assistant',
          text: data.reply,
          intent: data.intent,
        },
      ]);

      if (data.requiresLead) {
        setRequiresLead(true);
        window.setTimeout(() => {
          setShowLeadInline((current) => {
            if (leadCaptured) return current;
            return true;
          });
        }, 1800);
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
            height: '560px',
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
          <div
            style={{
              padding: '0.85rem 1.2rem',
              borderBottom: '1px solid rgba(148, 163, 184, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, #0f172a, #020617)',
              color: '#f9fafb',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '999px',
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                    focusable="false"
                    style={{ fill: 'none', stroke: '#e5e7eb', strokeWidth: 1.5 }}
                  >
                    <path d="M4 6.5C4 5.12 5.12 4 6.5 4h7A2.5 2.5 0 0 1 16 6.5v4A2.5 2.5 0 0 1 13.5 13H10l-2.8 2.1c-.6.45-1.45.02-1.45-.74V13A2.5 2.5 0 0 1 4 10.5v-4Z" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Chat with our AI</div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.75 }}>Answers in seconds, not days</div>
                </div>
              </div>
            </div>
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
                      const shouldOpenLead = option.id === 'see-pricing' || option.id === 'book-demo';
                      if (shouldOpenLead) {
                        window.setTimeout(() => {
                          setShowLeadInline((current) => {
                            if (leadCaptured) return current;
                            return true;
                          });
                        }, 1800);
                      }
                      void sendMessage(option.message, { openLeadAfter: shouldOpenLead });
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

            {(requiresLead || showLeadInline) && !leadCaptured && (
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
                placeholder="Ask a question..."
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
        </div>
      )}

      {!open && (
        <button
          type="button"
          onClick={openWindow}
          style={{
            position: 'fixed',
            ...alignmentStyle,
            width: '60px',
            height: '60px',
            borderRadius: '999px',
            border: 'none',
            background:
              'radial-gradient(circle at 30% 0%, rgba(248, 250, 252, 0.18), transparent 55%), ' +
              brandColor,
            color: '#f9fafb',
            boxShadow: '0 18px 40px rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 2147483000,
          }}
          aria-label="Open chat"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
            style={{ fill: 'none', stroke: '#f9fafb', strokeWidth: 1.8 }}
          >
            <rect x="5" y="6" width="14" height="10" rx="3" />
            <path d="M9 17.5 8 19.5" />
            <path d="M12 10h4" />
            <path d="M8 10h1.5" />
          </svg>
        </button>
      )}
    </>
  );
};

