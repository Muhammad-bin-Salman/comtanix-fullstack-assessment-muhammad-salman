import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listQuoteRequests, type QuoteListParams } from '../api/quotes';
import { useDebouncedValue } from '../hooks/use-debounced-value';
import type { PaginatedResponse, QuoteRequest } from '../types/api';
import { getApiErrorMessage } from '../utils/errors';
import { formatDate, formatLabel } from '../utils/format';

const statusOptions = ['new', 'in_review', 'quoted', 'closed'] as const;
const serviceTypeOptions = ['web_development', 'mobile_app', 'crm', 'ecommerce', 'custom_software'] as const;
const sortOptions = ['created_at', 'updated_at', 'client_name', 'status'] as const;
const perPageOptions = [10, 15, 25, 50] as const;

function positiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function QuoteListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearch = searchParams.get('search') ?? '';
  const [searchInput, setSearchInput] = useState(urlSearch);
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 400);
  const [result, setResult] = useState<PaginatedResponse<QuoteRequest> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  const page = positiveInteger(searchParams.get('page'), 1);
  const requestedPerPage = positiveInteger(searchParams.get('per_page'), 15);
  const perPage = perPageOptions.includes(requestedPerPage as (typeof perPageOptions)[number])
    ? requestedPerPage
    : 15;
  const sortBy = sortOptions.includes(searchParams.get('sort_by') as (typeof sortOptions)[number])
    ? searchParams.get('sort_by')!
    : 'created_at';
  const sortDirection = searchParams.get('sort_direction') === 'asc' ? 'asc' : 'desc';

  useEffect(() => {
    setSearchInput(urlSearch);
  }, [urlSearch]);

  useEffect(() => {
    if (debouncedSearch === urlSearch) {
      return;
    }

    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (debouncedSearch) {
        next.set('search', debouncedSearch);
      } else {
        next.delete('search');
      }
      next.set('page', '1');
      return next;
    }, { replace: true });
  }, [debouncedSearch, setSearchParams, urlSearch]);

  const apiParams = useMemo<QuoteListParams>(() => {
    const assignedUserId = positiveInteger(searchParams.get('assigned_user_id'), 0);

    return {
      search: urlSearch || undefined,
      status: searchParams.get('status') || undefined,
      assigned_user_id: assignedUserId || undefined,
      service_type: searchParams.get('service_type') || undefined,
      sort_by: sortBy,
      sort_direction: sortDirection,
      per_page: perPage,
      page,
    };
  }, [page, perPage, searchParams, sortBy, sortDirection, urlSearch]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError('');

    listQuoteRequests(apiParams, controller.signal)
      .then(setResult)
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setError(getApiErrorMessage(requestError, 'Unable to load quote requests.'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [apiParams, retryKey]);

  function updateParameter(name: string, value: string, resetPage = true) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value) {
        next.set(name, value);
      } else {
        next.delete(name);
      }
      if (resetPage) {
        next.set('page', '1');
      }
      return next;
    });
  }

  return (
    <section aria-labelledby="quotes-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Workspace</p>
          <h2 id="quotes-title">Quote requests</h2>
          <p className="muted">Review incoming enquiries and their current ownership.</p>
        </div>
        {result && <span className="total-count">{result.meta.total} total</span>}
      </div>

      <div className="filter-panel" aria-label="Quote filters">
        <div className="field field-search">
          <label htmlFor="quote-search">Search</label>
          <input
            id="quote-search"
            type="search"
            placeholder="Client, email, or company"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="status-filter">Status</label>
          <select
            id="status-filter"
            value={searchParams.get('status') ?? ''}
            onChange={(event) => updateParameter('status', event.target.value)}
          >
            <option value="">All statuses</option>
            {statusOptions.map((status) => <option key={status} value={status}>{formatLabel(status)}</option>)}
          </select>
        </div>

        <div className="field">
          <label htmlFor="service-filter">Service</label>
          <select
            id="service-filter"
            value={searchParams.get('service_type') ?? ''}
            onChange={(event) => updateParameter('service_type', event.target.value)}
          >
            <option value="">All services</option>
            {serviceTypeOptions.map((service) => <option key={service} value={service}>{formatLabel(service)}</option>)}
          </select>
        </div>

        <div className="field">
          <label htmlFor="assignee-filter">Assignee user ID</label>
          <input
            id="assignee-filter"
            type="number"
            min="1"
            placeholder="All assignees"
            value={searchParams.get('assigned_user_id') ?? ''}
            onChange={(event) => updateParameter('assigned_user_id', event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="sort-by">Sort by</label>
          <select id="sort-by" value={sortBy} onChange={(event) => updateParameter('sort_by', event.target.value)}>
            {sortOptions.map((option) => <option key={option} value={option}>{formatLabel(option)}</option>)}
          </select>
        </div>

        <div className="field">
          <label htmlFor="sort-direction">Direction</label>
          <select
            id="sort-direction"
            value={sortDirection}
            onChange={(event) => updateParameter('sort_direction', event.target.value)}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </div>

      {isLoading && <QuoteListLoading />}

      {!isLoading && error && (
        <div className="panel-state" role="alert">
          <h3>Could not load quotes</h3>
          <p>{error}</p>
          <button className="button button-primary" type="button" onClick={() => setRetryKey((value) => value + 1)}>
            Try again
          </button>
        </div>
      )}

      {!isLoading && !error && result?.data.length === 0 && (
        <div className="panel-state">
          <h3>No quote requests found</h3>
          <p>Try adjusting the search or filters.</p>
        </div>
      )}

      {!isLoading && !error && result && result.data.length > 0 && (
        <>
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col">Email</th>
                  <th scope="col">Company</th>
                  <th scope="col">Service</th>
                  <th scope="col">Budget</th>
                  <th scope="col">Status</th>
                  <th scope="col">Assigned To</th>
                  <th scope="col">Created At</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((quote) => (
                  <tr key={quote.id}>
                    <td className="cell-strong">{quote.client_name}</td>
                    <td><a href={`mailto:${quote.email}`}>{quote.email}</a></td>
                    <td>{quote.company ?? '—'}</td>
                    <td>{formatLabel(quote.service_type)}</td>
                    <td>{formatLabel(quote.budget_range)}</td>
                    <td><span className={`status-badge status-${quote.status}`}>{formatLabel(quote.status)}</span></td>
                    <td>{quote.assigned_user?.name ?? 'Unassigned'}</td>
                    <td>{formatDate(quote.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination" aria-label="Quote list pagination">
            <label htmlFor="per-page">Rows per page</label>
            <select
              id="per-page"
              value={perPage}
              onChange={(event) => updateParameter('per_page', event.target.value)}
            >
              {perPageOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <span>Page {result.meta.current_page} of {result.meta.last_page}</span>
            <button
              className="button button-secondary"
              type="button"
              disabled={!result.links.prev}
              onClick={() => updateParameter('page', String(page - 1), false)}
            >
              Previous
            </button>
            <button
              className="button button-secondary"
              type="button"
              disabled={!result.links.next}
              onClick={() => updateParameter('page', String(page + 1), false)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function QuoteListLoading() {
  return (
    <div className="table-card loading-card" role="status">
      <div className="spinner" aria-hidden="true" />
      <span>Loading quote requests…</span>
    </div>
  );
}
