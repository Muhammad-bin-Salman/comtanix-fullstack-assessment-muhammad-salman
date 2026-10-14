# Audit Service

## Overview

This TypeScript, Express, and MongoDB service receives HMAC-authenticated audit events from the Laravel Quote Request API. It stores events idempotently and exposes a paginated, filterable audit timeline.

## Requirements

- Node.js 20 or newer
- npm
- MongoDB

## Installation

```powershell
npm install
Copy-Item .env.example .env
```

## Environment variables

```dotenv
NODE_ENV=development
PORT=3001
MONGODB_URI=mongodb://127.0.0.1:27017/comtanix_audit
AUDIT_SHARED_SECRET=change-me
```

`AUDIT_SHARED_SECRET` is a placeholder. Replace it locally with the same strong secret configured in Laravel. The service refuses to start when the MongoDB URI or shared secret is missing.

## Running locally

Development with automatic reload:

```powershell
npm run dev
```

Production-style build and start:

```powershell
npm run build
npm start
```

The default URL is `http://127.0.0.1:3001`.

## MongoDB requirement

MongoDB must be running before the service starts. The default local database is `comtanix_audit`. Application startup connects to MongoDB before binding the HTTP port.

Tests do not use the development database. They start an isolated in-memory MongoDB instance and cache its ignored test binary under `.cache/`.

## POST /events

`POST /events` accepts this contract:

```json
{
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "quote.status_changed",
  "quoteRequestId": 123,
  "actorId": 1,
  "data": {
    "from": "new",
    "to": "in_review"
  },
  "occurredAt": "2026-10-15T10:30:00.000000Z"
}
```

Supported event types are `quote.created`, `quote.status_changed`, and `quote.assigned`. Valid first deliveries return HTTP 201 with `status: stored`; repeated `eventId` values return HTTP 200 with `status: duplicate`.

## HMAC verification

Laravel sends a lowercase hexadecimal HMAC-SHA256 signature in `X-Signature`. The service captures the request with route-scoped `express.raw()`, signs the original body bytes, checks buffer lengths, and compares signatures with `timingSafeEqual()` before parsing JSON.

Missing or invalid signatures return HTTP 401. The secret and expected signature are never returned to callers.

## Idempotency

`eventId` is protected by a unique MongoDB index. MongoDB duplicate-key error `11000` is treated as a successful duplicate delivery, making Laravel queue retries safe even when requests arrive concurrently.

## GET /events

`GET /events` returns intentional event fields only, ordered by `occurredAt` descending. It does not expose `_id`, `__v`, `createdAt`, or `updatedAt`.

Example:

```text
GET /events?quoteRequestId=123&type=quote.assigned&page=1&per_page=20
```

## Filters

| Parameter | Rules |
|---|---|
| `quoteRequestId` | Optional positive integer |
| `type` | Optional supported event type |

Filters work separately or together. Invalid filters return HTTP 422.

## Pagination

| Parameter | Default | Rules |
|---|---:|---|
| `page` | 1 | Positive integer |
| `per_page` | 20 | Integer from 1 to 100 |

Response shape:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 0,
    "total_pages": 0
  }
}
```

## MongoDB indexes

- Unique `{ eventId: 1 }` protects idempotency.
- `{ quoteRequestId: 1, occurredAt: -1 }` supports newest-first quote timelines.
- `{ type: 1, occurredAt: -1 }` supports newest-first event-type filtering.

The quote index can also narrow combined quote-and-type queries without adding another overlapping index for this assessment-sized workload.

## Tests

```powershell
npm test
npm run build
```

The suite covers HMAC authentication, exact raw bytes, validation, idempotency, Mongo uniqueness, filtering, pagination, ordering, and response-field safety.

## Security notes

`POST /events` is authenticated with the shared HMAC secret. `GET /events` is intentionally unauthenticated for this assessment and should be exposed only on a trusted internal/private network. A production browser client should preferably retrieve audit data through an authenticated Laravel proxy rather than connecting directly to this service.
