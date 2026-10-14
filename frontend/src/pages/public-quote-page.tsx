import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { submitPublicQuote } from '../api/public-quotes';
import type { PublicQuotePayload, ServiceType, ValidationErrorResponse } from '../types/api';
import axios from 'axios';
import { getApiErrorMessage } from '../utils/errors';
import { formatLabel } from '../utils/format';

const serviceTypes: ServiceType[] = ['web_development', 'mobile_app', 'crm', 'ecommerce', 'custom_software'];
const budgetRanges = ['under_5k', '5k_10k', '10k_25k', '25k_plus'] as const;
const initialForm: PublicQuotePayload = {
  client_name: '', email: '', company: '', service_type: 'web_development',
  budget_range: '', message: '', website: '',
};

export function PublicQuotePage() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  function updateField(name: keyof PublicQuotePayload, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: [] }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError('');
    setErrors({});
    try {
      await submitPublicQuote(form);
      setIsSubmitted(true);
    } catch (requestError) {
      if (axios.isAxiosError<ValidationErrorResponse>(requestError) && requestError.response?.status === 422) {
        setErrors(requestError.response.data.errors ?? {});
        setError('Please correct the highlighted fields and try again.');
      } else {
        setError(getApiErrorMessage(requestError, 'Unable to submit your quote request. Please try again.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSubmitted) {
    return (
      <main className="public-page">
        <section className="public-card panel-state" aria-labelledby="quote-success-title">
          <p className="eyebrow">Thank you</p>
          <h1 id="quote-success-title">Quote request received</h1>
          <p>Your quote request has been submitted successfully. Our team will review it shortly.</p>
          <button className="button button-primary" type="button" onClick={() => { setForm(initialForm); setIsSubmitted(false); }}>
            Submit another request
          </button>
          <Link to="/login">Staff sign in</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="public-page">
      <section className="public-card" aria-labelledby="quote-form-title">
        <p className="eyebrow">Comtanix</p>
        <h1 id="quote-form-title">Request a Quote</h1>
        <p className="muted">Tell us what you are planning and our team will review your request.</p>
        {error && <div className="alert alert-error" role="alert">{error}</div>}

        <form className="public-form" onSubmit={handleSubmit}>
          <FormField label="Client name" name="client_name" value={form.client_name} required error={errors.client_name?.[0]} onChange={updateField} />
          <FormField label="Email" name="email" type="email" value={form.email} required error={errors.email?.[0]} onChange={updateField} />
          <FormField label="Company" name="company" value={form.company} error={errors.company?.[0]} onChange={updateField} />

          <div className="field">
            <label htmlFor="service_type">Service</label>
            <select id="service_type" name="service_type" required value={form.service_type} onChange={(event) => updateField('service_type', event.target.value)}>
              {serviceTypes.map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
            </select>
            {errors.service_type?.[0] && <span className="field-error">{errors.service_type[0]}</span>}
          </div>

          <div className="field">
            <label htmlFor="budget_range">Budget range</label>
            <select id="budget_range" name="budget_range" value={form.budget_range} onChange={(event) => updateField('budget_range', event.target.value)}>
              <option value="">Not specified</option>
              {budgetRanges.map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
            </select>
            {errors.budget_range?.[0] && <span className="field-error">{errors.budget_range[0]}</span>}
          </div>

          <div className="field field-full">
            <label htmlFor="message">Project details</label>
            <textarea id="message" name="message" required minLength={10} maxLength={5000} rows={7} value={form.message} onChange={(event) => updateField('message', event.target.value)} />
            {errors.message?.[0] && <span className="field-error">{errors.message[0]}</span>}
          </div>

          <div className="visually-hidden" aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => updateField('website', event.target.value)} />
          </div>

          <button className="button button-primary field-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting…' : 'Submit quote request'}
          </button>
        </form>
        <p className="public-footer"><Link to="/login">Staff sign in</Link></p>
      </section>
    </main>
  );
}

type FormFieldProps = {
  label: string; name: 'client_name' | 'email' | 'company'; value: string;
  type?: string; required?: boolean; error?: string;
  onChange: (name: keyof PublicQuotePayload, value: string) => void;
};

function FormField({ label, name, value, type = 'text', required = false, error, onChange }: FormFieldProps) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} required={required} maxLength={255} value={value} onChange={(event) => onChange(name, event.target.value)} />
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
