import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { listQuoteAuditEvents } from '../api/audit';
import {
  assignQuoteRequest,
  deleteQuoteRequest,
  getQuoteRequest,
  updateQuoteStatus,
} from '../api/quotes';
import { listStaffUsers } from '../api/staff';
import { useAuth } from '../auth/auth-context';
import type { AuditEvent, QuoteRequest, QuoteStatus, StaffUser } from '../types/api';
import { getApiErrorMessage } from '../utils/errors';
import { formatDate, formatLabel } from '../utils/format';

const nextStatuses: Record<QuoteStatus, QuoteStatus[]> = {
  new: ['in_review'],
  in_review: ['quoted', 'closed'],
  quoted: ['closed'],
  closed: [],
};

export function QuoteDetailPage() {
  const { quoteId } = useParams();
  const id = Number(quoteId);
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [quote, setQuote] = useState<QuoteRequest | null>(null);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuditLoading, setIsAuditLoading] = useState(true);
  const [error, setError] = useState('');
  const [auditError, setAuditError] = useState('');
  const [mutationError, setMutationError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeMutation, setActiveMutation] = useState('');
  const [auditKey, setAuditKey] = useState(0);

  const loadQuote = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setQuote(await getQuoteRequest(id));
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) && requestError.response?.status === 404
        ? 'Quote request not found.'
        : getApiErrorMessage(requestError, 'Unable to load this quote request.'));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!Number.isInteger(id) || id < 1) {
      setError('Quote request not found.');
      setIsLoading(false);
      return;
    }
    void loadQuote();
  }, [id, loadQuote]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    listStaffUsers().then(setStaffUsers).catch(() => setMutationError('Unable to load staff users.'));
  }, [user?.role]);

  useEffect(() => {
    if (!Number.isInteger(id) || id < 1) return;
    setIsAuditLoading(true);
    setAuditError('');
    listQuoteAuditEvents(id)
      .then((response) => setEvents(response.data))
      .catch(() => setAuditError('Audit history is temporarily unavailable.'))
      .finally(() => setIsAuditLoading(false));
  }, [auditKey, id]);

  const staffById = useMemo(() => new Map(staffUsers.map((staff) => [staff.id, staff.name])), [staffUsers]);
  const canUpdateStatus = Boolean(quote && user && (user.role === 'admin' || quote.assigned_user_id === user.id));

  async function runMutation(label: string, mutation: () => Promise<QuoteRequest>) {
    setActiveMutation(label);
    setMutationError('');
    setSuccess('');
    try {
      setQuote(await mutation());
      setSuccess(label);
      setAuditKey((value) => value + 1);
    } catch (requestError) {
      setMutationError(getApiErrorMessage(requestError, 'The requested change could not be completed.'));
    } finally {
      setActiveMutation('');
    }
  }

  async function handleDelete() {
    if (!quote || !window.confirm('Delete this quote request? This action removes it from normal views.')) return;
    setActiveMutation('delete');
    setMutationError('');
    try {
      await deleteQuoteRequest(quote.id);
      navigate(`/quotes${backSearch}`, { replace: true });
    } catch (requestError) {
      setMutationError(getApiErrorMessage(requestError, 'Unable to delete this quote request.'));
      setActiveMutation('');
    }
  }

  const backSearch = (location.state as { fromSearch?: string } | null)?.fromSearch ?? '';

  if (isLoading) return <div className="panel-state" role="status">Loading quote request…</div>;
  if (error || !quote) {
    return <div className="panel-state" role="alert"><h2>{error}</h2><Link to={`/quotes${backSearch}`}>Back to Quotes</Link></div>;
  }

  return (
    <section aria-labelledby="quote-title">
      <Link className="back-link" to={`/quotes${backSearch}`}>← Back to Quotes</Link>
      <div className="page-heading detail-heading">
        <div><p className="eyebrow">Quote #{quote.id}</p><h2 id="quote-title">{quote.client_name}</h2><p className="muted">{quote.company ?? 'No company provided'}</p></div>
        <span className={`status-badge status-${quote.status}`}>{formatLabel(quote.status)}</span>
      </div>

      {success && <div className="alert alert-success" role="status">{success}</div>}
      {mutationError && <div className="alert alert-error" role="alert">{mutationError}</div>}

      <div className="detail-grid">
        <article className="card">
          <h3>Request details</h3>
          <dl className="detail-list">
            <Detail label="Email" value={quote.email} />
            <Detail label="Service" value={formatLabel(quote.service_type)} />
            <Detail label="Budget" value={formatLabel(quote.budget_range)} />
            <Detail label="Assigned to" value={quote.assigned_user?.name ?? 'Unassigned'} />
            <Detail label="Created" value={formatDate(quote.created_at)} />
            <Detail label="Updated" value={formatDate(quote.updated_at)} />
          </dl>
          <h3>Message</h3><p className="message-content">{quote.message}</p>
        </article>

        <aside className="action-stack">
          <section className="card">
            <h3>Status workflow</h3>
            {canUpdateStatus && nextStatuses[quote.status].length > 0 ? (
              <div className="button-row">
                {nextStatuses[quote.status].map((status) => (
                  <button key={status} className="button button-primary" type="button" disabled={Boolean(activeMutation)}
                    onClick={() => void runMutation(`Status updated to ${formatLabel(status)}.`, () => updateQuoteStatus(quote.id, status))}>
                    Mark {formatLabel(status)}
                  </button>
                ))}
              </div>
            ) : <p className="muted">{quote.status === 'closed' ? 'This quote is closed.' : 'Status changes are available only to the assigned staff member or an admin.'}</p>}
          </section>

          {user?.role === 'admin' && (
            <section className="card">
              <h3>Assignment</h3>
              <label htmlFor="assignee">Assign to staff member</label>
              <select id="assignee" value={quote.assigned_user_id ?? ''} disabled={Boolean(activeMutation)}
                onChange={(event) => void runMutation('Assignment updated.', () => assignQuoteRequest(quote.id, Number(event.target.value)))}>
                <option value="" disabled>Select staff member</option>
                {staffUsers.map((staff) => <option key={staff.id} value={staff.id}>{staff.name} ({staff.email})</option>)}
              </select>
            </section>
          )}

          {user?.role === 'admin' && (
            <section className="card danger-zone"><h3>Delete quote</h3><p className="muted">Soft-delete this request from normal API results.</p>
              <button className="button button-danger" type="button" disabled={Boolean(activeMutation)} onClick={() => void handleDelete()}>Delete quote</button>
            </section>
          )}
        </aside>
      </div>

      <section className="card audit-card" aria-labelledby="audit-title">
        <div className="section-heading"><h3 id="audit-title">Audit timeline</h3>{auditError && <button className="button button-secondary" onClick={() => setAuditKey((value) => value + 1)}>Retry</button>}</div>
        {isAuditLoading && <p role="status">Loading audit history…</p>}
        {!isAuditLoading && auditError && <p className="alert alert-error" role="alert">{auditError}</p>}
        {!isAuditLoading && !auditError && events.length === 0 && <p className="muted">No audit events found.</p>}
        {!isAuditLoading && !auditError && events.length > 0 && <ol className="timeline">{events.map((event) => <li key={event.eventId}><strong>{describeEvent(event, staffById)}</strong><span>{formatDate(event.occurredAt)}{event.actorId ? ` · Actor #${event.actorId}` : ''}</span></li>)}</ol>}
      </section>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function describeEvent(event: AuditEvent, staffById: Map<number, string>): string {
  if (event.type === 'quote.created') return 'Quote request created';
  if (event.type === 'quote.status_changed') return `Status changed from ${formatLabel(String(event.data.from ?? ''))} to ${formatLabel(String(event.data.to ?? ''))}`;
  const assignee = (value: unknown) => value === null ? 'Unassigned' : staffById.get(Number(value)) ?? `user #${value}`;
  return `Assignment changed from ${assignee(event.data.from)} to ${assignee(event.data.to)}`;
}
