# Development Guide

## Local architecture and environment

`docker compose up -d` starts persistent MySQL (`3306`) and MongoDB (`27017`) development databases. Application processes run locally for transparent review. Copy each service's `.env.example`; never commit the resulting `.env` files.

| Service | Required values |
|---|---|
| Laravel | `DB_HOST=127.0.0.1`, `DB_DATABASE=comtanix_quotes`, `DB_USERNAME=comtanix`, `DB_PASSWORD=comtanix`, `QUEUE_CONNECTION=database`, `AUDIT_SERVICE_URL=http://127.0.0.1:3001`, `AUDIT_SHARED_SECRET=change-me`, `AUDIT_REQUEST_TIMEOUT=5` |
| Audit | `PORT=3001`, `MONGODB_URI=mongodb://127.0.0.1:27017/comtanix_audit`, `AUDIT_SHARED_SECRET=change-me`, `NODE_ENV=development` |
| Frontend | `VITE_API_BASE_URL=http://127.0.0.1:8000/api` |

The Laravel and audit-service shared secrets must match. `change-me` is only a local placeholder.

Run Laravel with `php artisan serve`, its worker with `php artisan queue:work`, the audit service with `npm run dev`, and React with `npm run dev`. Start MySQL and MongoDB first. Full installation commands are in the root README and the [Laravel](../api-laravel/README.md), [audit-service](../audit-service/README.md), and [frontend](../frontend/README.md) guides.

## Adding a quote

### Public web form

Open <http://localhost:5173/request-quote>, complete the form, and submit. No authentication is required. Laravel validates the request, forces status `new`, leaves it unassigned, and queues `quote.created` after persistence.

### Postman

Import `api-laravel/postman/Comtanix-Laravel-API.postman_collection.json`, set its `base_url` if necessary, and run **Submit Quote Request** (`POST /api/public/quote-requests`).

### Direct API

```bash
curl -X POST http://127.0.0.1:8000/api/public/quote-requests \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Jane Smith",
    "email": "jane@example.com",
    "company": "Acme Ltd",
    "service_type": "web_development",
    "budget_range": "10k_25k",
    "message": "We need help building a new customer portal.",
    "website": ""
  }'
```

Supported services are `web_development`, `mobile_app`, `crm`, `ecommerce`, and `custom_software`. Supported budgets are `under_5k`, `5k_10k`, `10k_25k`, and `25k_plus`.

## Demo seed data

From `api-laravel`, run `php artisan db:seed`. It creates or updates these fixed assessment accounts:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@comtanix.test` | `Password123!` |
| Staff | `staff1@comtanix.test` | `Password123!` |
| Staff | `staff2@comtanix.test` | `Password123!` |

These are **development/assessment credentials only** and must not be reused in production.

The quote seeder preserves existing records and tops up active quotes to 200. With 200 or more it adds nothing; it never truncates or deletes existing quotes. Generated assignments target the two staff accounts only. Factory-based seeding bypasses HTTP mutation flows, so it does not enqueue audit-delivery jobs.

## Audit reliability and recovery

Laravel commits each business mutation before dispatching its audit job with after-commit semantics, so API success does not depend on Node availability. `PublishAuditEvent` has seven attempts and backoff delays of 10, 30, 60, 120, 300, and 600 seconds. A stable UUID is generated before dispatch; Node's unique `eventId` index makes retries idempotent. Exhausted jobs enter `failed_jobs` and are logged; after recovery, operators can inspect with `php artisan queue:failed` and retry with `php artisan queue:retry <id>`.

This provides practical asynchronous delivery, not an absolute delivery guarantee. A production evolution could add a transactional outbox plus dead-letter/queue monitoring.

## Scale notes (approximately 5M records)

MySQL currently indexes quote `status`, `(assigned_user_id, status)`, and `(service_type, created_at)`. List queries paginate, eager-load the assignee, and whitelist filters/sorts rather than loading the full dataset. At larger scale, inspect real plans with `EXPLAIN`, monitor slow queries, prefer cursor pagination for deep navigation, and consider archival/partitioning, targeted caching, or read replicas only when workload measurements justify them.

MongoDB has a unique `eventId` index plus `(quoteRequestId, occurredAt desc)` and `(type, occurredAt desc)`. Quote timelines therefore remain indexed. At 5M events, measure combined-filter usage before adding a compound quote/type/time index, balance index write cost, and define retention or archive policies if history grows indefinitely.

## Security and intentional tradeoffs

- Laravel uses Sanctum bearer authentication, Policies/Gates, Form Requests, protected-field control, public per-IP throttling, a honeypot, and admin-only soft deletion.
- Audit delivery signs the exact raw JSON bytes with HMAC-SHA256. Node uses a timing-safe comparison, a shared secret, UUID idempotency, and a unique Mongo index.
- React reads audit history through authenticated Laravel; Node GET should remain private/internal rather than browser-exposed.
- The dashboard stores bearer tokens in `sessionStorage` for assessment simplicity. This limits persistence but retains XSS exposure; secure HttpOnly cookie authentication is preferable where appropriate in production.
- Database containers use explicit development credentials. No real secrets are committed, and service `.env` files are ignored.
- Databases are containerized while apps run locally to keep review simple.
- Laravel queue retries are used instead of a transactional outbox.
- React deliberately avoids an additional server-state framework at this project size.
- The honeypot is lightweight spam friction, not a CAPTCHA or comprehensive abuse platform.

## Tests and API tools

```bash
cd api-laravel
php artisan test
./vendor/bin/pint --test

cd ../audit-service
npm test
npm run build

cd ../frontend
npm test
npm run build

cd ..
docker compose config
git diff --check
```

The Postman collection lives at `api-laravel/postman/Comtanix-Laravel-API.postman_collection.json`. Frontend routes are `/login`, `/request-quote`, `/quotes`, and `/quotes/:quoteId`.

## Troubleshooting

- Audit timeline unavailable: confirm Node and MongoDB are running, both shared secrets match, and inspect `php artisan queue:failed`.
- Events not delivered: ensure `QUEUE_CONNECTION=database` and a `php artisan queue:work` process is active.
- Database connection refused: run `docker compose ps`, wait for health checks, and verify Laravel/Mongo connection values.
- Browser API failures: confirm Laravel is on `127.0.0.1:8000` and `VITE_API_BASE_URL` includes `/api`.

## AI-use disclosure

AI-assisted development tools were used to accelerate portions of implementation, debugging, test-case development, code review, and documentation. AI suggestions were treated as development assistance rather than authoritative output; implementation decisions were reviewed, adjusted where necessary, and validated through automated tests and manual integration checks.

Representative use included implementation/scaffolding assistance, test-case suggestions, debugging environment and integration issues, and documentation drafting/review. Final code was reviewed, commands and tests were executed, API integrations were manually verified where local infrastructure permitted, and the candidate remains responsible for explaining the architectural and security decisions.
