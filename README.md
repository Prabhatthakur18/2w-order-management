# 2W Order Management

Dealer order management for two-wheeler parts — order capture through to dispatch.

Architecture, decisions and the phase plan live in [TECH_STACK.md](TECH_STACK.md).

## Stack

Next.js 15 · TypeScript · Tailwind 4 · PostgreSQL 16 · Prisma 6 · Auth.js 5

Mobile-first: the ASM places orders from a phone in the field.

## Setup

### 1. Database

**Already installed and seeded.** PostgreSQL 16 runs natively inside WSL2 on **port 5433**.

Port 5432 is taken by a separate Windows PostgreSQL 17 service belonging to another project, so this one uses 5433 to stay out of its way.

After a Windows reboot, start it with:

```bash
wsl -u root service postgresql start
```

<details>
<summary>How it was set up (for reference / rebuilding)</summary>

```bash
wsl -u root apt-get install -y postgresql postgresql-contrib
# port changed to 5433 in /etc/postgresql/16/main/postgresql.conf
wsl -u root service postgresql start
wsl -u root su - postgres -c "psql -c \"CREATE USER twom WITH PASSWORD 'twom' CREATEDB;\""
wsl -u root su - postgres -c "psql -c 'CREATE DATABASE twom_dev OWNER twom;'"
```

WSL's root user needs no password, which avoids the interactive `sudo` prompt.
</details>

### 2. Environment

`.env` already exists with a generated `AUTH_SECRET`. For a fresh clone:

```bash
cp .env.example .env
npx auth secret        # writes AUTH_SECRET
```

### 3. Schema and seed

Already applied — 32 tables created and seeded. To rebuild:

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
