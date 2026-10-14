# Quote Request Dashboard

## Overview

React and TypeScript staff dashboard for the Comtanix quote-request API. It provides authenticated quote discovery, detail review, role-aware mutations, and an audit timeline obtained through Laravel.

## Requirements

- Node.js 20+
- npm
- Laravel API running locally

## Installation and environment

```bash
npm install
copy .env.example .env
```

Set `VITE_API_BASE_URL` to the Laravel API root (the example uses `http://127.0.0.1:8000/api`).

## Commands

```bash
npm run dev
npm test
npm run build
```

## Authentication

The dashboard uses Laravel Sanctum bearer tokens. The token is stored in `sessionStorage`, restored with `GET /api/user`, attached by the shared Axios client, and cleared centrally after a 401 response. Session storage is pragmatic for this assessment and limits persistence to the browser session, but remains exposed to XSS; a production application should consider secure HttpOnly cookie authentication.

## Routes

- `/login` — staff/admin sign-in
- `/quotes` — searchable, filterable, sortable, paginated quote list
- `/quotes/:quoteId` — quote details, permitted actions, and audit timeline

List state is synchronized with URL query parameters so refresh and browser navigation preserve search, filters, sorting, and pagination.

## Quote detail and actions

Admins can perform valid status transitions, assign/reassign to staff loaded from Laravel, and soft-delete quotes. Staff can update status only when the quote is assigned to them. Controls reflect these roles for usability, while Laravel remains authoritative for authorization and workflow validation.

## Audit timeline

The browser calls Laravel's authenticated quote audit endpoint. Laravel proxies the internal audit service, so its URL is not exposed to React. Audit loading and failures are isolated from the quote detail view and can be retried independently.
