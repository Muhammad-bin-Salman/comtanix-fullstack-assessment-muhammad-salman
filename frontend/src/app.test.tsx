import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { currentUserRequest, loginRequest, logoutRequest } from './api/auth';
import { listQuoteRequests } from './api/quotes';
import { AuthProvider } from './auth/auth-provider';
import { getStoredToken, storeToken } from './auth/storage';
import type { PaginatedResponse, QuoteRequest, User } from './types/api';

vi.mock('./api/auth', () => ({
  currentUserRequest: vi.fn(),
  loginRequest: vi.fn(),
  logoutRequest: vi.fn(),
}));

vi.mock('./api/quotes', () => ({
  listQuoteRequests: vi.fn(),
}));

const admin: User = {
  id: 1,
  name: 'Assessment Admin',
  email: 'admin@comtanix.test',
  role: 'admin',
};

const quote: QuoteRequest = {
  id: 42,
  client_name: 'Acme Client',
  email: 'client@acme.test',
  company: 'Acme Ltd',
  service_type: 'web_development',
  budget_range: '10k_25k',
  message: 'A sufficiently detailed quote request.',
  status: 'new',
  assigned_user_id: null,
  assigned_user: null,
  created_at: '2026-10-15T10:00:00.000000Z',
  updated_at: '2026-10-15T10:00:00.000000Z',
};

function paginatedResult(
  data: QuoteRequest[] = [quote],
  page = 1,
  lastPage = 1,
): PaginatedResponse<QuoteRequest> {
  return {
    data,
    links: {
      first: 'http://api.test?page=1',
      last: `http://api.test?page=${lastPage}`,
      prev: page > 1 ? `http://api.test?page=${page - 1}` : null,
      next: page < lastPage ? `http://api.test?page=${page + 1}` : null,
    },
    meta: {
      current_page: page,
      from: data.length ? 1 : null,
      last_page: lastPage,
      links: [],
      path: 'http://api.test/quote-requests',
      per_page: 15,
      to: data.length,
      total: data.length,
    },
  };
}

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(currentUserRequest).mockResolvedValue({ user: admin });
  vi.mocked(loginRequest).mockResolvedValue({ token: 'test-token', user: admin });
  vi.mocked(logoutRequest).mockResolvedValue();
  vi.mocked(listQuoteRequests).mockResolvedValue(paginatedResult());
});

describe('authentication', () => {
  it('redirects an unauthenticated protected route to login', async () => {
    renderApp('/quotes');

    expect(await screen.findByRole('heading', { name: 'Staff sign in' })).toBeInTheDocument();
  });

  it('stores the bearer token after successful login', async () => {
    const user = userEvent.setup();
    renderApp('/login');

    await user.type(screen.getByLabelText('Email'), 'admin@comtanix.test');
    await user.type(screen.getByLabelText('Password'), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await screen.findByRole('heading', { name: 'Quote requests' });
    expect(getStoredToken()).toBe('test-token');
  });

  it('clears an invalid restored session and returns to login', async () => {
    storeToken('expired-token');
    vi.mocked(currentUserRequest).mockRejectedValueOnce(new Error('Unauthenticated'));

    renderApp('/quotes');

    expect(await screen.findByRole('heading', { name: 'Staff sign in' })).toBeInTheDocument();
    expect(getStoredToken()).toBeNull();
  });
});

describe('quote list', () => {
  function authenticate() {
    storeToken('valid-token');
  }

  it('renders quote data returned by the API', async () => {
    authenticate();
    renderApp('/quotes');

    expect(await screen.findByText('Acme Client')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Web Development' })).toBeInTheDocument();
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });

  it('debounces search and resets the requested page', async () => {
    authenticate();
    const user = userEvent.setup();
    renderApp('/quotes?page=2');
    await screen.findByText('Acme Client');

    await user.type(screen.getByLabelText('Search'), 'Acme');

    await waitFor(() => {
      expect(listQuoteRequests).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'Acme', page: 1 }),
        expect.any(AbortSignal),
      );
    }, { timeout: 1_500 });
  });

  it('resets the page when a filter changes', async () => {
    authenticate();
    const user = userEvent.setup();
    renderApp('/quotes?page=3');
    await screen.findByText('Acme Client');

    await user.selectOptions(screen.getByLabelText('Status'), 'new');

    await waitFor(() => {
      expect(listQuoteRequests).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'new', page: 1 }),
        expect.any(AbortSignal),
      );
    });
  });

  it('updates URL-derived page state when pagination is used', async () => {
    authenticate();
    vi.mocked(listQuoteRequests).mockImplementation(async (params) => paginatedResult([quote], params.page, 3));
    const user = userEvent.setup();
    renderApp('/quotes');

    await screen.findByText('Page 1 of 3');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument();
    expect(listQuoteRequests).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
      expect.any(AbortSignal),
    );
  });

  it('renders a loading state', async () => {
    authenticate();
    vi.mocked(listQuoteRequests).mockReturnValue(new Promise(() => {}));

    renderApp('/quotes');

    expect(await screen.findByRole('status')).toHaveTextContent('Loading quote requests…');
  });

  it('renders an empty state', async () => {
    authenticate();
    vi.mocked(listQuoteRequests).mockResolvedValue(paginatedResult([]));

    renderApp('/quotes');

    expect(await screen.findByRole('heading', { name: 'No quote requests found' })).toBeInTheDocument();
  });

  it('renders an API error with a retry action', async () => {
    authenticate();
    vi.mocked(listQuoteRequests).mockRejectedValue(new Error('Network failure'));

    renderApp('/quotes');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Unable to load quote requests.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
