# Quote Request Manager

A three-service full-stack assessment: React provides public and staff interfaces, Laravel owns authentication and quote workflows in MySQL, and queued Laravel jobs publish signed audit events to Express/MongoDB.

```text
Public/Staff Browser
        |
      React
        |
   Laravel API -------- MySQL
        |
   Database Queue
        |
  Audit Service ------- MongoDB
```

Audit reads also pass through authenticated Laravel endpoints; the browser never receives the internal audit-service URL.

## Quick start

```bash
docker compose up -d

cd api-laravel
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan db:seed
php artisan serve
```

Run `php artisan queue:work` in another Laravel terminal. Then start the remaining services:

```bash
cd audit-service
npm install
cp .env.example .env
npm run dev

cd ../frontend
npm install
cp .env.example .env
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

- Frontend: <http://localhost:5173>
- Public quote form: <http://localhost:5173/request-quote>
- Laravel API: <http://127.0.0.1:8000>
- Audit service: <http://127.0.0.1:3001>

Demo accounts are `admin@comtanix.test`, `staff1@comtanix.test`, and `staff2@comtanix.test`, all using `Password123!`. These are development/assessment credentials only.

## Verification

```bash
cd api-laravel && php artisan test && ./vendor/bin/pint --test
cd audit-service && npm test && npm run build
cd frontend && npm test && npm run build
docker compose config
```

See [development guidance](docs/DEVELOPMENT.md) for environment values, adding quotes, seeding, reliability, scale, security, tradeoffs, and troubleshooting. Service-specific details are in [Laravel](api-laravel/README.md), [audit service](audit-service/README.md), and [frontend](frontend/README.md).

## AI-assisted development

AI-assisted development tools were used to accelerate portions of implementation, debugging, test-case development, code review, and documentation. AI suggestions were treated as development assistance rather than authoritative output; implementation decisions were reviewed, adjusted where necessary, and validated through automated tests and manual integration checks.
