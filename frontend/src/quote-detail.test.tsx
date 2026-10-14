import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { currentUserRequest, loginRequest, logoutRequest } from './api/auth';
import { listQuoteAuditEvents } from './api/audit';
import { assignQuoteRequest, deleteQuoteRequest, getQuoteRequest, listQuoteRequests, updateQuoteStatus } from './api/quotes';
import { listStaffUsers } from './api/staff';
import { AuthProvider } from './auth/auth-provider';
import { storeToken } from './auth/storage';
import type { QuoteRequest, User } from './types/api';

vi.mock('./api/auth', () => ({ currentUserRequest: vi.fn(), loginRequest: vi.fn(), logoutRequest: vi.fn() }));
vi.mock('./api/quotes', () => ({
  listQuoteRequests: vi.fn(), getQuoteRequest: vi.fn(), updateQuoteStatus: vi.fn(),
  assignQuoteRequest: vi.fn(), deleteQuoteRequest: vi.fn(),
}));
vi.mock('./api/audit', () => ({ listQuoteAuditEvents: vi.fn() }));
vi.mock('./api/staff', () => ({ listStaffUsers: vi.fn() }));

const admin: User = { id: 1, name: 'Admin', email: 'admin@test.test', role: 'admin' };
const staff: User = { id: 6, name: 'Staff One', email: 'staff@test.test', role: 'staff' };
const quote: QuoteRequest = {
  id: 42, client_name: 'Acme Client', email: 'client@acme.test', company: 'Acme Ltd',
  service_type: 'web_development', budget_range: '10k_25k', message: 'Build our new platform.',
  status: 'new', assigned_user_id: null, assigned_user: null,
  created_at: '2026-10-15T10:00:00Z', updated_at: '2026-10-15T10:00:00Z',
};

function renderDetail(user: User = admin) {
  storeToken('token');
  vi.mocked(currentUserRequest).mockResolvedValue({ user });
  return render(<MemoryRouter initialEntries={['/quotes/42']}><AuthProvider><App /></AuthProvider></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loginRequest).mockResolvedValue({ token: 'token', user: admin });
  vi.mocked(logoutRequest).mockResolvedValue();
  vi.mocked(getQuoteRequest).mockResolvedValue(quote);
  vi.mocked(listStaffUsers).mockResolvedValue([{ id: 6, name: 'Staff One', email: 'staff@test.test' }]);
  vi.mocked(listQuoteAuditEvents).mockResolvedValue({ data: [], meta: { page: 1, per_page: 100, total: 0, total_pages: 0 } });
  vi.mocked(updateQuoteStatus).mockResolvedValue({ ...quote, status: 'in_review' });
  vi.mocked(assignQuoteRequest).mockResolvedValue({ ...quote, assigned_user_id: 6, assigned_user: staff });
  vi.mocked(deleteQuoteRequest).mockResolvedValue();
});

describe('quote detail', () => {
  it('renders quote information and admin controls', async () => {
    renderDetail();
    expect(await screen.findByRole('heading', { name: 'Acme Client' }, { timeout: 3_000 })).toBeInTheDocument();
    expect(screen.getByText('Build our new platform.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark In Review' })).toBeInTheDocument();
    expect(screen.getByLabelText('Assign to staff member')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete quote' })).toBeInTheDocument();
  });

  it('hides mutation controls from unassigned staff', async () => {
    renderDetail(staff);
    await screen.findByRole('heading', { name: 'Acme Client' });
    expect(screen.queryByRole('button', { name: 'Mark In Review' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Assign to staff member')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete quote' })).not.toBeInTheDocument();
  });

  it('shows valid status action to assigned staff and calls the status endpoint', async () => {
    vi.mocked(getQuoteRequest).mockResolvedValue({ ...quote, assigned_user_id: 6, assigned_user: staff });
    const user = userEvent.setup();
    renderDetail(staff);
    await user.click(await screen.findByRole('button', { name: 'Mark In Review' }));
    expect(updateQuoteStatus).toHaveBeenCalledWith(42, 'in_review');
    expect(await screen.findByText('Status updated to In Review.')).toBeInTheDocument();
  });

  it('assigns using staff IDs returned by the API', async () => {
    const user = userEvent.setup();
    renderDetail();
    await user.selectOptions(await screen.findByLabelText('Assign to staff member'), '6');
    expect(listStaffUsers).toHaveBeenCalled();
    expect(assignQuoteRequest).toHaveBeenCalledWith(42, 6);
  });

  it('confirms deletion, calls the endpoint, and returns to the list', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(listQuoteRequests).mockResolvedValue({ data: [], links: { first: null, last: null, prev: null, next: null }, meta: { current_page: 1, from: null, last_page: 1, links: [], path: '', per_page: 15, to: null, total: 0 } });
    const user = userEvent.setup();
    renderDetail();
    await user.click(await screen.findByRole('button', { name: 'Delete quote' }));
    await waitFor(() => expect(deleteQuoteRequest).toHaveBeenCalledWith(42));
    expect(await screen.findByRole('heading', { name: 'Quote requests' })).toBeInTheDocument();
  });

  it('renders audit history and actor details', async () => {
    vi.mocked(listQuoteAuditEvents).mockResolvedValue({
      data: [{ eventId: 'event-1', type: 'quote.status_changed', quoteRequestId: 42, actorId: 1, data: { from: 'new', to: 'in_review' }, occurredAt: '2026-10-15T11:00:00Z' }],
      meta: { page: 1, per_page: 100, total: 1, total_pages: 1 },
    });
    renderDetail();
    expect(await screen.findByText('Status changed from New to In Review')).toBeInTheDocument();
    expect(screen.getByText(/Actor #1/)).toBeInTheDocument();
  });

  it('shows audit loading independently', async () => {
    vi.mocked(listQuoteAuditEvents).mockReturnValue(new Promise(() => {}));
    renderDetail();
    expect(await screen.findByRole('heading', { name: 'Acme Client' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Loading audit history…');
  });

  it('keeps details usable when audit history fails', async () => {
    vi.mocked(listQuoteAuditEvents).mockRejectedValue(new Error('offline'));
    renderDetail();
    expect(await screen.findByRole('heading', { name: 'Acme Client' })).toBeInTheDocument();
    expect(await screen.findByText('Audit history is temporarily unavailable.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('renders a not-found state', async () => {
    vi.mocked(getQuoteRequest).mockRejectedValue({ isAxiosError: true, response: { status: 404 } });
    renderDetail();
    expect(await screen.findByRole('heading', { name: 'Quote request not found.' })).toBeInTheDocument();
  });

  it('shows backend mutation errors', async () => {
    vi.mocked(updateQuoteStatus).mockRejectedValue(new Error('failed'));
    const user = userEvent.setup();
    renderDetail();
    await user.click(await screen.findByRole('button', { name: 'Mark In Review' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The requested change could not be completed.');
  });
});
