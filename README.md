# 2W Order Management

Dealer order management for two-wheeler parts — order capture through to dispatch.

Architecture, decisions and the phase plan live in [TECH_STACK.md](TECH_STACK.md).

## Stack

Next.js 15 · TypeScript · Tailwind 4 · PostgreSQL 17 · Prisma 6 · Auth.js 5

Mobile-first: the ASM places orders from a phone in the field.

## Running it

```bash
npm run dev
```

Open **http://localhost:3100**. That is the whole thing — one command.

The database is the PostgreSQL 17 already running as a Windows service, so there is nothing to start and nothing to remember after a reboot.

## Setup

### 1. Database

**Already created and seeded** — database `twom_dev` on `localhost:5432`, alongside the existing `autoform_mis` database, which is untouched.

<details>
<summary>How it was set up (for reference / rebuilding)</summary>

```sql
CREATE ROLE twom LOGIN PASSWORD 'twom' CREATEDB;
CREATE DATABASE twom_dev OWNER twom;
```

Run as the `postgres` superuser via
`"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h 127.0.0.1`.
</details>

### 2. Environment

`.env` already exists with a generated `AUTH_SECRET`. For a fresh clone:

```bash
cp .env.example .env
npx auth secret        # writes AUTH_SECRET
```

### 3. Schema and seed

Already applied. To rebuild:

```bash
npm install
npm run db:push        # create tables
npm run db:seed        # users + business rules
npm run db:seed:demo   # demo catalog (placeholder data)
```

Port 3100, not 3000 — another local project already uses 3000.

## Demo logins

Password for all: `Passw0rd!`

| Role | Email |
|---|---|
| Admin | admin@autoformindia.com |
| ASM | asm@autoformindia.com |
| Plant Ops | plant@autoformindia.com |
| Accounts | accounts@autoformindia.com |
| Dispatch | dispatch@autoformindia.com |

Dealer logins are seeded off — see TECH_STACK.md §2.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server on 3100 |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:push` | Sync schema without a migration |
| `npm run db:migrate` | Create a migration |
| `npm run db:studio` | Prisma Studio |
| `npm run db:seed` | Seed demo data |

## Conventions

- **Money is `Decimal(14,2)` in Postgres and `decimal.js` in code.** Never a JS number.
- **Generated PDFs and PIs are never stored** — rendered at runtime from live DB state. Document *numbers* are persisted; the files are not.
- **Uploads live outside the web root** and are served only through authenticated route handlers.
- **RBAC is enforced server-side** in every page and action. Middleware is a convenience, not the security boundary.
