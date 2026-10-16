<div align="center">

# Saquá360 — Project Dashboard

**Project and KPI tracking for the municipal departments of Saquarema (RJ, Brazil).**

🇧🇷 [Leia em português](README.pt-BR.md)

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white) ![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white) ![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white) ![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white) ![Vitest](https://img.shields.io/badge/Vitest-tested-6E9F18?logo=vitest&logoColor=white)

</div>

## About

Internal web app used by the city administration to register each department (*secretaria*), its projects, the people responsible for them and the indicators that measure progress. Administrators get a consolidated view; department users only see and edit what belongs to them. Every change is recorded in an audit log.

## Features

- Departments, projects and multiple owners per project
- Indicators with configurable scales and update deadlines
- Role-based access (admin, project admin, read-only / can-edit users)
- Full audit log of who changed what and when
- Password reset by e-mail and forced password change on first login
- Login throttling persisted in the database
- Charts with Recharts and light/dark theme

## Tech stack

| Layer | Technology |
|---|---|
| App | Next.js 16 (App Router, Server Actions), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui (Base UI), Lucide, Sonner, Recharts |
| Auth | Signed session cookie (`jose`), `bcryptjs` |
| Data | MySQL / MariaDB + Prisma ORM with versioned migrations |
| E-mail | Nodemailer (SMTP) with HTML templates |
| Tests | Vitest + coverage (v8) |

## Architecture

```
app/            routes (admin area, login, password change) and auth API routes
lib/actions/    Server Actions: all reads/writes go through here, with authz checks
lib/            session, permissions, audit, mail and Prisma client
prisma/         schema + 14 versioned migrations
scripts/        seeds (admin, departments, metrics)
templates/      e-mail templates
tests/          Vitest suites
```
Mutations run as **Server Actions** that check the session and the user's role before touching the database, and write an `AuditLog` entry in the same flow.

## Security

- Session in a signed, httpOnly cookie; passwords hashed with bcrypt
- Login throttling stored in MySQL (`LoginThrottle`), proxy-aware via `TRUSTED_PROXY_COUNT`
- Constant-time comparisons for secrets (`timingSafeEqual`)
- Authorization enforced server-side in every Server Action, not only in the UI

## Getting started

**Prerequisites:** Node.js 20+, MySQL 8 or MariaDB

```bash
cp .env.example .env      # fill in the variables below
npm install
npm run db:setup          # prisma generate + migrate dev
npm run db:seed           # creates the first admin from ADMIN_USERNAME / ADMIN_PASSWORD
npm run dev               # http://localhost:3002
```
For an existing database (staging/production) use `npm run db:setup:deploy`, which only applies committed migrations.

### Environment variables

`.env.example` — Never commit real values. Copy the example file and fill it locally.

| Variable | Description |
|---|---|
| `DATABASE_URL` | MySQL connection string |
| `SESSION_SECRET` | Long random secret used to sign the session cookie |
| `TRUSTED_PROXY_COUNT` | Number of reverse proxies in front of the app (for client IP) |
| `ADMIN_USERNAME / ADMIN_PASSWORD` | First admin account created by the seed |
| `MAIL_HOST / MAIL_PORT / MAIL_USER / MAIL_PASS` | SMTP settings for password-reset e-mails |

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server on port 3002 |
| `npm run build` | `prisma generate` + production build |
| `npm test` | Run the Vitest suite |
| `npm run test:coverage` | Tests with coverage report |
| `npm run lint` | ESLint |
| `npm run prisma:studio` | Prisma Studio |

## Testing

20 Vitest test files under `tests/` covering permissions, session handling, audit and server actions. Run `npm test`.

## Team

- [Vinícius Diller](https://github.com/viniciusdiller)
- [Vinicius do Valle](https://github.com/vallevinicius)
