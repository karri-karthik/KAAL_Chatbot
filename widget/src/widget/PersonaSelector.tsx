import React from 'react';
import { type PersonaType } from './types';

const PERSONA_TITLE_COLOR = '#0f172a';

interface Persona {
  id: PersonaType;
  name: string;
  shortDescription: string;
  longDescription: string;
  exampleMessage: string;
}

export const PERSONAS: Persona[] = [
  {
    id: 'consultant',
    name: 'The Consultant',
    shortDescription: 'Professional & Authoritative',
    longDescription:
      'Your personal enrollment advisor. Expert at matching you with the right program and showcasing outcomes. Be prepared for qualifying questions and confident recommendations.',
    exampleMessage:
      "Based on your goals, I'd recommend our 'Zero-to-Hero' Data Science track. Want to see placement stats?",
  },
  {
    id: 'expert',
    name: 'The Expert',
    shortDescription: 'Efficient & Precise',
    longDescription:
      'Straight to the point. Gets you accurate answers about courses, schedules, and logistics instantly. No fluff, just facts. Perfect when you need information fast.',
    exampleMessage:
      "The Python module starts Monday at 7 PM. It's 100% live, so plan accordingly. Any other questions?",
  },
  {
    id: 'peer',
    name: 'The Peer',
    shortDescription: 'Witty & Friendly',
    longDescription:
      'Like chatting with a cool senior who gets it. Uses light humor, casual vibes, and genuine warmth. Always steers you toward value while keeping it real.',
    exampleMessage:
      "My existence is a joke - I'm an AI trapped in a website. Anyway, want to learn how to build one of me? 🎓",
  },
];

interface PersonaSelectorProps {
  onSelect: (persona: PersonaType) => void;
  brandColor?: string;
}

export const PersonaSelector: React.FC<PersonaSelectorProps> = ({ onSelect, brandColor = '#1E3A5F' }) => {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '1rem 1.1rem 1.25rem',
        background: 'radial-gradient(circle at top, rgba(226, 232, 240, 0.8), transparent 55%), #f9fafb',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '1rem', maxWidth: '360px', width: '100%', alignSelf: 'center' }}>
        <p style={{ fontSize: '0.84rem', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
          Tap a style below. You can change it anytime from the chat header.
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          width: '100%',
          maxWidth: '360px',
          alignSelf: 'center',
        }}
      >
        {PERSONAS.map((persona) => (
          <button
            key={persona.id}
            onClick={() => onSelect(persona.id)}
            style={{
              display: 'block',
              padding: '1rem',
              borderRadius: '16px',
              border: `2px solid ${brandColor}25`,
              background: '#ffffff',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textAlign: 'left',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = `${brandColor}60`;
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(15, 23, 42, 0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = `${brandColor}25`;
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.08)';
            }}
          >
            <div
              style={{
                fontSize: '0.95rem',
                fontWeight: 700,
                color: PERSONA_TITLE_COLOR,
                marginBottom: '0.25rem',
              }}
            >
              {persona.name}
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: '#64748b',
                fontWeight: 500,
                marginBottom: '0.5rem',
              }}
            >
              {persona.shortDescription}
            </div>
            <div
              style={{
                fontSize: '0.8rem',
                color: '#475569',
                lineHeight: 1.5,
                marginBottom: '0.5rem',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {persona.longDescription}
            </div>
            <div
              style={{
                fontSize: '0.78rem',
                color: '#64748b',
                fontStyle: 'italic',
                padding: '0.5rem',
                background: '#f8fafc',
                borderRadius: '8px',
                borderLeft: `3px solid ${brandColor}`,
              }}
            >
              "{persona.exampleMessage}"
            </div>
          </button>
        ))}
      </div>

      <div
        style={{
          marginTop: '1.25rem',
          fontSize: '0.7rem',
          color: '#94a3b8',
          textAlign: 'center',
          flexShrink: 0,
        }}
      >
        Your choice will be remembered for this session
      </div>
    </div>
  );
};

export default PersonaSelector;
