import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { submitPublicQuote } from './api/public-quotes';
import type { QuoteRequest } from './types/api';

vi.mock('./api/public-quotes', () => ({ submitPublicQuote: vi.fn() }));

const createdQuote: QuoteRequest = {
  id: 201, client_name: 'Jane Smith', email: 'jane@example.com', company: 'Acme Ltd',
  service_type: 'web_development', budget_range: '10k_25k', message: 'We need a customer portal.',
  status: 'new', assigned_user_id: null, assigned_user: null,
  created_at: '2026-10-15T12:00:00Z', updated_at: '2026-10-15T12:00:00Z',
};

function renderPage() {
  return render(<MemoryRouter initialEntries={['/request-quote']}><App /></MemoryRouter>);
}

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText('Client name'), { target: { value: 'Jane Smith' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } });
  fireEvent.change(screen.getByLabelText('Company'), { target: { value: 'Acme Ltd' } });
  fireEvent.change(screen.getByLabelText('Service'), { target: { value: 'web_development' } });
  fireEvent.change(screen.getByLabelText('Budget range'), { target: { value: '10k_25k' } });
  fireEvent.change(screen.getByLabelText('Project details'), { target: { value: 'We need a customer portal.' } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(submitPublicQuote).mockResolvedValue(createdQuote);
});

describe('public quote request', () => {
  it('is accessible without authentication and renders expected fields', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Request a Quote' })).toBeInTheDocument();
    expect(screen.getByLabelText('Client name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Company')).toBeInTheDocument();
    expect(screen.getByLabelText('Service')).toBeInTheDocument();
    expect(screen.getByLabelText('Budget range')).toBeInTheDocument();
    expect(screen.getByLabelText('Project details')).toBeInTheDocument();
  });

  it('submits the valid payload with an empty honeypot and shows confirmation', async () => {
    const user = userEvent.setup();
    renderPage();
    fillRequiredFields();
    await user.click(screen.getByRole('button', { name: 'Submit quote request' }));

    expect(submitPublicQuote).toHaveBeenCalledWith({
      client_name: 'Jane Smith', email: 'jane@example.com', company: 'Acme Ltd',
      service_type: 'web_development', budget_range: '10k_25k',
      message: 'We need a customer portal.', website: '',
    });
    expect(await screen.findByText(/submitted successfully/)).toBeInTheDocument();
  });

  it('shows Laravel validation errors', async () => {
    vi.mocked(submitPublicQuote).mockRejectedValue({
      isAxiosError: true,
      response: { status: 422, data: { message: 'Validation failed.', errors: { email: ['The email field must be a valid email address.'] } } },
    });
    const user = userEvent.setup();
    renderPage();
    fillRequiredFields();
    await user.click(screen.getByRole('button', { name: 'Submit quote request' }));
    expect(await screen.findByText('The email field must be a valid email address.')).toBeInTheDocument();
  });

  it('handles rate-limit and network failures', async () => {
    vi.mocked(submitPublicQuote).mockRejectedValue({
      isAxiosError: true,
      response: { status: 429, data: { message: 'Too Many Attempts.' } },
    });
    const user = userEvent.setup();
    renderPage();
    fillRequiredFields();
    await user.click(screen.getByRole('button', { name: 'Submit quote request' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too Many Attempts.');
  });

  it('shows a useful message when the API cannot be reached', async () => {
    vi.mocked(submitPublicQuote).mockRejectedValue({ isAxiosError: true, request: {} });
    const user = userEvent.setup();
    renderPage();
    fillRequiredFields();
    await user.click(screen.getByRole('button', { name: 'Submit quote request' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach the API.');
  });

  it('disables submission while the request is pending', async () => {
    vi.mocked(submitPublicQuote).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderPage();
    fillRequiredFields();
    await user.click(screen.getByRole('button', { name: 'Submit quote request' }));
    expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled();
  });
});
