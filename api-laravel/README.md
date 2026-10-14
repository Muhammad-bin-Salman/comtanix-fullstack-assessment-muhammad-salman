# Laravel Quote Request API

## Overview

This Laravel 12 service manages staff authentication, public quote submissions, quote review and assignment workflows, role-based authorization, and asynchronous audit-event delivery to the companion audit service.

## Requirements

- PHP 8.2 or newer
- Composer
- MySQL or a compatible relational database
- Laravel 12 dependencies installed through Composer
- A Laravel queue worker for audit-event delivery

## Installation

```powershell
composer install
Copy-Item .env.example .env
php artisan key:generate
```

Configure the `DB_*` values in `.env`, then run:

```powershell
php artisan migrate
php artisan db:seed
```

The seeder preserves existing quotes and only adds enough demo records to reach 200 active quote requests. It never truncates the table.

## Seeded credentials

These accounts and their shared password are for local development and assessment demonstration only.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@comtanix.test` | `Password123!` |
| Staff | `staff1@comtanix.test` | `Password123!` |
| Staff | `staff2@comtanix.test` | `Password123!` |

Do not reuse these credentials in production.

## Running Laravel

```powershell
php artisan serve
```

The default local API URL is `http://127.0.0.1:8000`.

## Queue worker

```powershell
php artisan queue:work
```

Audit publishing is asynchronous and requires a running queue worker. Keep `QUEUE_CONNECTION=database` so an unavailable audit service cannot block the main API request.

## Audit configuration

```dotenv
AUDIT_SERVICE_URL=http://localhost:3001
AUDIT_SHARED_SECRET=change-me
AUDIT_REQUEST_TIMEOUT=5
```

`AUDIT_SHARED_SECRET` must be replaced locally and must match the secret configured by the Node audit service. It is used to generate the HMAC-SHA256 signature sent in `X-Signature`.

## Main API endpoints

All authenticated endpoints use a Sanctum bearer token.

| Method | Endpoint | Authentication | Purpose / restriction |
|---|---|---|---|
| `POST` | `/api/login` | Public | Authenticate an admin or staff user and issue a token. |
| `POST` | `/api/logout` | Bearer token | Revoke the current token. |
| `GET` | `/api/user` | Bearer token | Return the authenticated user. |
| `POST` | `/api/public/quote-requests` | Public | Submit a public quote request. |
| `GET` | `/api/quote-requests` | Bearer token | List, search, filter, sort, and paginate quotes. |
| `GET` | `/api/quote-requests/{quoteRequest}` | Bearer token | View one non-deleted quote. |
| `PATCH` | `/api/quote-requests/{quoteRequest}/status` | Bearer token | Admin: any quote. Staff: assigned quotes only. |
| `PATCH` | `/api/quote-requests/{quoteRequest}/assign` | Admin bearer token | Assign or reassign a quote to a staff user. |
| `DELETE` | `/api/quote-requests/{quoteRequest}` | Admin bearer token | Soft-delete a quote. |

## Quote statuses

Supported statuses:

- `new`
- `in_review`
- `quoted`
- `closed`

Allowed transitions:

```text
new -> in_review
in_review -> quoted
in_review -> closed
quoted -> closed
```

Same-status updates and every other transition return a validation-style `422` response.

## Authorization summary

Admin users can view quotes, update status, assign or reassign staff, and soft-delete quotes.

Staff users can view all quotes and update status only when the quote is assigned to them. Staff cannot assign, reassign, or delete quotes.

## List endpoint parameters

`GET /api/quote-requests` supports:

| Parameter | Description |
|---|---|
| `search` | Searches client name, email, and company. |
| `status` | Filters by a supported quote status. |
| `assigned_user_id` | Filters by an existing user ID. |
| `service_type` | Filters by an allowed service type. |
| `sort_by` | `created_at`, `updated_at`, `client_name`, or `status`. |
| `sort_direction` | `asc` or `desc`. |
| `per_page` | Page size from 1 to 100; default is 15. |

Default sorting is `created_at desc`.

## Public anti-abuse controls

Public quote submission includes request validation, a `website` honeypot field, per-IP throttling, and explicit rejection of protected fields such as `status`, `assigned_user_id`, and `deleted_at`.

## Tests

```powershell
php artisan test
```

PHPUnit forces SQLite `:memory:` and therefore does not use the configured development MySQL database. Feature tests cover authentication, authorization, quote operations, seeding, audit dispatch, and exact raw-body HMAC signing.

## Important queue behavior

Database mutations complete independently of the external audit service. Successful quote creation, status changes, and assignment changes enqueue audit jobs after database commit. Delivery runs asynchronously, retries transient failures with backoff, and records exhausted jobs in `failed_jobs`.

## AI assistance

AI-assisted development tools were used for implementation guidance and code review. All changes were manually reviewed, tested, and validated.
