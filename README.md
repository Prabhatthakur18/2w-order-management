# 2W Order Management

Dealer order management for two-wheeler parts — order capture through to dispatch.

Architecture, decisions and the phase plan live in [TECH_STACK.md](TECH_STACK.md).

## Stack

Next.js 15 · TypeScript · Tailwind 4 · PostgreSQL 17 · Prisma 6 · Auth.js 5

Mobile-first: the ASM places orders from a phone in the field.

## Running it

Once set up, this is the whole thing:

```bash
npm run dev
```

Open **http://localhost:3100**.

First time on this machine? See [Setup from a fresh clone](#setup-from-a-fresh-clone) below.

## Setup from a fresh clone

You need **Node.js 22.x LTS** (22.12.0 is what the project is developed against)
and **PostgreSQL 17** running locally.

### 1. Install dependencies

```bash
npm install
```

### 2. Create the database

Connect as the `postgres` superuser and create the role and database:

```sql
CREATE ROLE twom LOGIN PASSWORD 'twom' CREATEDB;
CREATE DATABASE twom_dev OWNER twom;
```

On Windows that connection is
`"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h 127.0.0.1`.
On macOS or Linux, `psql -U postgres -h 127.0.0.1`.

Use a different password if you like — just match it in `DATABASE_URL` below.

### 3. Environment

```bash
cp .env.example .env
npx auth secret        # generates AUTH_SECRET into .env
```

Then open `.env` and set:

| Variable | What to put |
|---|---|
| `DATABASE_URL` | `postgresql://twom:twom@localhost:5432/twom_dev?schema=public` — match the password you used above |
| `AUTH_SECRET` | written for you by `npx auth secret` |
| `AUTH_TRUST_HOST` | `true` |
| `UPLOAD_ROOT` | `./.uploads` for local dev. Must sit outside the web root |
| `MAX_UPLOAD_MB` | `8` |
| `GSTINCHECK_API_KEY` | Ask Prabhat. Only needed to test GSTIN auto-fill — the rest of the app runs without it |

`.env` is gitignored and must stay that way. Never commit it.

### 4. Schema and seed

```bash
npm run db:migrate     # create tables by applying prisma/migrations
npm run db:seed        # users + business rules
npm run db:seed:demo   # demo catalog (placeholder data)
```

Schema changes go through a migration — `npm run db:migrate` prompts for a name,
writes the SQL under `prisma/migrations/`, and applies it. Commit that folder:
it is how staging and production get the same schema you have locally.

`npm run db:push` still works and is quicker while iterating on the schema, but
it leaves no migration behind. Anything pushed that way must be turned into a
migration before it ships.

### 5. Run it

```bash
npm run dev
```

Open **http://localhost:3100**. Port 3100, not 3000 — another local project
already uses 3000.

### Before you push

```bash
npm run typecheck
npm run test
npm run lint
```

<details>
<summary>Note for the original dev machine</summary>

On Prabhat's machine all of the above is already done: `twom_dev` exists on
`localhost:5432` alongside the `autoform_mis` database (untouched), `.env`
exists with a generated `AUTH_SECRET`, and the schema is pushed and seeded.
PostgreSQL 17 runs as a Windows service, so there is nothing to start after a
reboot. `npm run dev` is the whole thing.
</details>

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

### OTP login

The login page also offers an OTP flow. **No email/WhatsApp provider is wired up
yet**, so the code is not actually sent — it is printed to the terminal running
`npm run dev`:

```
[OTP STUB] EMAIL to asm@autoformindia.com: 123456 (expires in 10m)
```

Copy it from there. Swapping in a real provider means changing only the delivery
step in [src/lib/otp.ts](src/lib/otp.ts) — the schema and flow stay as they are.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server on 3100 |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | All unit tests (pricing, number-to-words, storage, lifecycle) |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:push` | Sync schema without a migration — local iteration only |
| `npm run db:migrate` | Create and apply a migration — the path to staging/prod |
| `npm run db:studio` | Prisma Studio |
| `npm run db:seed` | Seed demo data |

## Conventions

- **Money is `Decimal(14,2)` in Postgres and `decimal.js` in code.** Never a JS number.
- **Generated PDFs and PIs are never stored** — rendered at runtime from live DB state. Document *numbers* are persisted; the files are not.
- **Uploads live outside the web root** and are served only through authenticated route handlers.
- **RBAC is enforced server-side** in every page and action. Middleware is a convenience, not the security boundary.
