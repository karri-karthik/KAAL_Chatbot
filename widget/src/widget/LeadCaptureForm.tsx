import React, { useState } from 'react';
import type { LeadPayload } from './types';

interface LeadCaptureFormProps {
  sessionId: string;
  apiBaseUrl?: string;
  onSubmitted?: () => void;
}

export const LeadCaptureForm: React.FC<LeadCaptureFormProps> = ({ sessionId, apiBaseUrl, onSubmitted }) => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    query: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = apiBaseUrl || import.meta.env.VITE_API_BASE_URL;

  const handleChange = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const validate = () => {
    if (form.name.trim().length < 2 || form.name.trim().length > 80) {
      return 'Please enter a valid name.';
    }
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!emailRegex.test(form.email.trim())) {
      return 'Please enter a valid email address.';
    }
    if (form.phone && form.phone.replace(/\D/g, '').length < 7) {
      return 'Please enter a valid phone number or leave it blank.';
    }
    if (form.query.length > 500) {
      return 'Message is too long.';
    }
    return null;
  };

  const handleSubmit: React.FormEventHandler = async (event) => {
    event.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!baseUrl) {
      setError('Lead capture is not configured.');
      return;
    }

    const payload: LeadPayload = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      query: form.query.trim() || undefined,
      sessionId,
      timestamp: new Date().toISOString(),
      sourceUrl: window.location.href,
    };

    try {
      setSubmitting(true);
      const res = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? 'Lead submission failed');
      }

      setSubmitted(true);
      if (onSubmitted) {
        onSubmitted();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div
        style={{
          padding: '0.9rem 1rem',
          borderRadius: '16px',
          backgroundColor: '#ecfdf3',
          border: '1px solid #4ade80',
          fontSize: '0.85rem',
          color: '#14532d',
        }}
      >
        Thank you! A team member will be in touch shortly.
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        borderRadius: '16px',
        padding: '0.9rem 1rem',
        backgroundColor: '#ffffff',
        border: '1px solid rgba(148, 163, 184, 0.6)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}
    >
      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Share your details</div>
      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>We&apos;ll follow up with pricing or a demo.</div>

      <label style={{ fontSize: '0.75rem', fontWeight: 500 }}>
        Name *
        <input
          type="text"
          required
          value={form.name}
          onChange={handleChange('name')}
          style={{
            width: '100%',
            marginTop: '0.15rem',
            borderRadius: '10px',
            border: '1px solid rgba(148, 163, 184, 0.9)',
            padding: '0.4rem 0.6rem',
            fontSize: '0.8rem',
          }}
        />
      </label>

      <label style={{ fontSize: '0.75rem', fontWeight: 500 }}>
        Email *
        <input
          type="email"
          required
          value={form.email}
          onChange={handleChange('email')}
          style={{
            width: '100%',
            marginTop: '0.15rem',
            borderRadius: '10px',
            border: '1px solid rgba(148, 163, 184, 0.9)',
            padding: '0.4rem 0.6rem',
            fontSize: '0.8rem',
          }}
        />
      </label>

      <label style={{ fontSize: '0.75rem', fontWeight: 500 }}>
        Phone
        <input
          type="tel"
          value={form.phone}
          onChange={handleChange('phone')}
          style={{
            width: '100%',
            marginTop: '0.15rem',
            borderRadius: '10px',
            border: '1px solid rgba(148, 163, 184, 0.9)',
            padding: '0.4rem 0.6rem',
            fontSize: '0.8rem',
          }}
        />
      </label>

      <label style={{ fontSize: '0.75rem', fontWeight: 500 }}>
        Message / Query
        <textarea
          value={form.query}
          onChange={handleChange('query')}
          rows={3}
          maxLength={500}
          style={{
            width: '100%',
            marginTop: '0.15rem',
            borderRadius: '10px',
            border: '1px solid rgba(148, 163, 184, 0.9)',
            padding: '0.4rem 0.6rem',
            fontSize: '0.8rem',
            resize: 'vertical',
          }}
        />
      </label>

      {error && (
        <div style={{ fontSize: '0.75rem', color: '#b91c1c' }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        style={{
          marginTop: '0.3rem',
          borderRadius: '999px',
          border: 'none',
          padding: '0.5rem 0.9rem',
          fontSize: '0.8rem',
          fontWeight: 600,
          backgroundColor: '#111827',
          color: '#f9fafb',
          cursor: submitting ? 'wait' : 'pointer',
        }}
      >
        {submitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
};

