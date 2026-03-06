import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LeadCaptureForm } from './LeadCaptureForm';

describe('LeadCaptureForm', () => {
  it('submits successfully with valid data', async () => {
    render(<LeadCaptureForm sessionId="test-session" apiBaseUrl="http://localhost:4000" />);

    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'jane@example.com' } });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, leadId: '123' }),
    } as Response);

    const submit = screen.getByRole('button', { name: /submit/i });
    submit.click();

    expect(
      await screen.findByText(/Thank you! A team member will be in touch shortly/i),
    ).toBeInTheDocument();
  });
});

