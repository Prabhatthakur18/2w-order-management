# 2W Order Management

Dealer order management for two-wheeler parts — order capture through to dispatch.

Architecture, decisions and the phase plan live in [TECH_STACK.md](TECH_STACK.md).

## Stack

Next.js 15 · TypeScript · Tailwind 4 · PostgreSQL 16 · Prisma 6 · Auth.js 5

Mobile-first: the ASM places orders from a phone in the field.

## Setup

### 1. Database (one-time)

PostgreSQL 16 runs natively inside WSL2 — not Docker, which would cost 2–3GB of RAM on this machine.

```bash
wsl
sudo apt update && sudo apt install -y postgresql-16
sudo service postgresql start
sudo -u postgres psql -c "CREATE USER twom WITH PASSWORD 'twom' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE twom_dev OWNER twom;"
```

Postgres in WSL2 is reachable from Windows at `localhost:5432`.

To start it after a reboot: `wsl sudo service postgresql start`

### 2. Environment

```bash
cp .env.example .env
npx auth secret        # writes AUTH_SECRET
```

### 3. Schema and seed

```bash
npm install
npm run db:push        # create tables
npm run db:seed        # demo users + default business rules
```

### 4. Run

```bash
npm run dev            # http://localhost:3100
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
