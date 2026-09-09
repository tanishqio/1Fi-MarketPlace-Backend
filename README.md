# 1Fi Marketplace — Backend API

> **TypeScript · Express 5 · Prisma 7 · PostgreSQL (Neon) · Bun**
> A RESTful catalogue-query engine for a multi-brand, multi-category e-commerce marketplace — resolves product variants, brand filters, and featured-product feeds from a single Neon-hosted PostgreSQL instance via a type-safe Prisma ORM layer.

[![Language](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Runtime](https://img.shields.io/badge/Bun-1.x-fbf0df?logo=bun&logoColor=black)](https://bun.sh/)
[![Framework](https://img.shields.io/badge/Express-5.2.1-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![ORM](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Database](https://img.shields.io/badge/PostgreSQL-Neon-00E5A0?logo=postgresql&logoColor=white)](https://neon.tech/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Why This Exists

E-commerce frontends require aggregated product data (brand logo, lowest-priced variant, category membership) in a single round-trip; naive N+1 query patterns across separate REST calls to a third-party catalogue service introduce latency and coupling. This backend centralises all catalogue reads through Prisma's relational query layer, returning pre-joined payloads so the frontend makes **one call per view** rather than composing data client-side.

---

## Key Features

- **Category-scoped brand discovery** — returns all brands that have at least one product in a given category, eliminating dead-end brand listings on the frontend
- **Featured-product feed** — filters products by `Rating ≥ 10` and attaches the lowest-priced variant (single SQL join, ordered `ASC LIMIT 1`), reducing frontend data-munging logic
- **Brand-filtered product catalogue** — resolves a brand name to an ID server-side and returns all products with their cheapest variant; avoids exposing integer IDs to URL paths
- **Variant-first data model** — products carry zero prices; all pricing and stock data lives on `ProductVariant` with a JSONB `attributes` column, enabling size/colour/spec variants without schema changes
- **Typed schema with migration history** — 2 versioned Prisma migrations; schema drift is caught at CI time, not at runtime
- **Connection pooling via `@prisma/adapter-pg`** — uses the `pg` driver adapter instead of Prisma's default query engine binary, giving explicit control over the PostgreSQL connection pool
- **CORS allowlist** — origin whitelist enforced at middleware level (localhost:3000 + production Vercel domain), preventing cross-origin misuse

---

## Architecture

### System Diagram

```mermaid
graph TD
    FE["Frontend\n(Vercel / localhost:3000)"]
    API["Express 5 API Server\n(Bun runtime · port 3005)"]
    PRISMA["Prisma Client 7\n(adapter-pg driver)"]
    POOL["pg Connection Pool\n(@prisma/adapter-pg)"]
    NEON["Neon PostgreSQL\n(us-east-2 · SSL required)"]

    FE -->|"HTTP · CORS-restricted"| API
    API -->|"Prisma query DSL"| PRISMA
    PRISMA -->|"pg Driver"| POOL
    POOL -->|"TLS/SSL · connection string"| NEON

    subgraph DB Schema
        CAT["Categories"]
        BRAND["Brands"]
        PROD["Products"]
        VAR["ProductVariant"]
        IMG["ProductImage"]

        CAT --> PROD
        BRAND --> PROD
        PROD --> VAR
        VAR --> IMG
    end

    NEON --- CAT
```

### Design Decision Callouts

| Decision | Rationale |
|---|---|
| **Why Bun as runtime** | Native TypeScript execution without a transpile step; `bun --watch` gives hot-reload in dev with zero configuration |
| **Why Express 5** | Async error propagation is built-in (rejected promises bubble to error middleware without `next(err)` wrappers), reducing boilerplate in route handlers |
| **Why Prisma 7 with `adapter-pg`** | The `client` engine type (vs. the default Rust query engine binary) removes a native binary dependency, simplifying containerisation; `adapter-pg` exposes the underlying `pg` pool for explicit connection management |
| **Why Neon PostgreSQL** | Serverless PostgreSQL with connection pooling built into the platform URL; the `?sslmode=require&channel_binding=require` params enforce encrypted transit at the connection string level |
| **Why JSONB for `attributes` and `ProductDetails`** | Product variant attributes (size, colour, material) are unstructured and brand-specific; JSONB avoids an EAV table while remaining queryable via PostgreSQL's `->` operator if filtering is needed later |
| **Why variant-first pricing** | A `Products` row carries no price; all prices live on `ProductVariant`. This cleanly separates product identity from SKU-level economics and supports multi-currency or tiered pricing without schema migration |
| **Why unique index on `Name` (Categories, Brands, Products)** | Routes resolve names to IDs server-side (e.g. `GET /api/topbrands/:categoryname`). The unique index makes these lookups O(log n) and enforces data integrity at the DB layer rather than application layer |

---

## Tech Stack

| Layer | Technology | Purpose | Version |
|---|---|---|---|
| Runtime | Bun | TypeScript execution, package manager, dev server | 1.x |
| Language | TypeScript | Static typing; strict mode enabled | 5.x |
| Web Framework | Express | HTTP routing, middleware, JSON body parsing | 5.2.1 |
| ORM | Prisma Client | Type-safe database queries, migrations, schema management | 7 |
| DB Driver Adapter | `@prisma/adapter-pg` | pg-native connection pool adapter for Prisma | 7 |
| Database | PostgreSQL (Neon) | Relational data store; serverless, SSL-enforced | 16.x (Neon managed) |
| CORS Middleware | `cors` | Origin allowlist enforcement | 2.8.6 |
| Type Definitions | `@types/express`, `@types/cors` | TypeScript definitions for runtime libraries | 5.0.6 / 2.8.19 |

---

## Getting Started

### Prerequisites

| Tool | Minimum Version | Install |
|---|---|---|
| Bun | 1.0 | `curl -fsSL https://bun.sh/install \| bash` |
| Node.js | 18 (for tooling only) | https://nodejs.org |
| PostgreSQL | 14+ (or Neon account) | https://neon.tech |
| Git | any | https://git-scm.com |

### Install

```bash
git clone https://github.com/tanishqio/1Fi-MarketPlace-Backend.git
cd 1Fi-MarketPlace-Backend/backend
bun install
# postinstall script runs `prisma generate` automatically
```

### Environment Variables

Create a `.env` file in the project root. The table below documents every variable the application reads at startup:

| Variable | Description | Required | Default |
|---|---|---|---|
| `DATABASE_URL` | Full PostgreSQL connection string (supports Neon pooler URLs). Must include `sslmode=require` for Neon. | ✅ Yes | — |
| `PORT` | TCP port the Express server binds to | ✅ Yes | — |

**Example `.env`:**
```env
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require&channel_binding=require"
PORT=3005
```

> **Note:** `.env` is listed in `.gitignore` and must never be committed. The application will throw at startup if `DATABASE_URL` is absent because `PrismaClient` fails to initialise without a datasource URL.

### Run Locally

```bash
# Development (hot-reload via bun --watch)
bun run dev

# Production
bun run start
```

Server logs: `Server running on port <PORT>`

### Apply Database Migrations

```bash
# Apply all pending migrations to the target DATABASE_URL
bunx prisma migrate deploy

# Or, in development, create a new migration from schema changes
bunx prisma migrate dev --name <migration_name>
```

---

## API Reference

All public catalogue endpoints are prefixed `/api`. Admin write endpoints are unprefixed (see roadmap for planned auth layer).

| Method | Route | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/topbrands/:categoryname` | Returns all brands (`id`, `Name`, `logoUrl`) that have ≥ 1 product in the named category. Resolves category name → ID server-side. | No |
| `GET` | `/api/featuredproducts` | Returns all products with `Rating ≥ 10`, each with their lowest-priced variant (`attributes`, `price`, `stock`). | No |
| `GET` | `/api/getproductsbybrand/:brandname` | Returns all products for a named brand, each with their lowest-priced variant. Resolves brand name → ID server-side. | No |
| `POST` | `/addcategory` | Creates a new category. Body: `{ name: string, url: string }` | No (⚠ unprotected — see Roadmap) |
| `POST` | `/addbrands` | Creates a new brand. Body: `{ name: string, url: string }` | No (⚠ unprotected — see Roadmap) |
| `POST` | `/addproduct` | Creates a new product. Body: `{ name, url, brandId, categoryId, Rating }` | No (⚠ unprotected — see Roadmap) |
| `POST` | `/addproductcvariant/:productid` | Creates a product variant. Body: `{ sku, price, stock, attributes }` | No (⚠ unprotected — see Roadmap) |

### Response Shape (example)

```jsonc
// GET /api/topbrands/Electronics
{
  "message": "top brands for given category",
  "topbrands": [
    { "id": 1, "Name": "Samsung", "logoUrl": "https://..." }
  ]
}
```

```jsonc
// GET /api/featuredproducts
{
  "message": "top brands for given category",
  "featuredproducts": [
    {
      "id": 3,
      "Name": "Galaxy S25",
      "ImageUrl": "https://...",
      "Rating": 12,
      "variants": [
        { "price": 74999, "stock": 50, "attributes": { "color": "black", "storage": "256GB" } }
      ]
    }
  ]
}
```

---

## Project Structure

```
backend/
├── index.ts                  # Express app: CORS config, route definitions, server listen
├── prisma.config.ts          # Prisma CLI config: schema path, migrations path, datasource URL
├── package.json              # Dependencies, scripts (dev / start / postinstall)
├── tsconfig.json             # TypeScript: strict mode, bundler resolution, ESNext target
├── bun.lock                  # Bun lockfile (deterministic installs)
├── .env                      # Runtime secrets — NOT committed (gitignored)
├── .gitignore                # Ignores node_modules, dist, .env, logs, caches
│
├── prisma/
│   ├── schema.prisma         # Data model: Categories, Brands, Products, ProductVariant, ProductImage
│   ├── db.ts                 # Prisma client singleton with @prisma/adapter-pg connection pool
│   └── migrations/
│       ├── 20260907190623_created_tables/         # Initial schema: all 5 tables + indexes + FK constraints
│       └── 20260908082430_made_string_optional_category/  # Made Categories.ImageUrl nullable
│
└── src/
    └── generated/
        └── prisma/           # Auto-generated Prisma client (output of `prisma generate`)
```

---

## Database Schema

Five tables with referential integrity enforced via FK constraints at the PostgreSQL level:

```
Categories (id PK, Name UNIQUE, ImageUrl?)
    │
    └─── Products (id PK, Name UNIQUE, ImageUrl, description?, ProductDetails JSONB?, brandId FK, categoryId FK, Rating)
              │
              └─── ProductVariant (id PK, ProductId FK, sku UNIQUE, price, stock, attributes JSONB?)
                        │
                        └─── ProductImage (id PK, variantId FK, imageUrl, Position, altText?)

Brands (id PK, Name UNIQUE, logoUrl)
    │
    └─── Products (brandId FK)
```

**Notable constraints:**
- `Products.Name`, `Categories.Name`, `Brands.Name`, `ProductVariant.sku` each carry a `UNIQUE` index — deduplication is enforced at the DB layer
- All FK relationships use `ON DELETE RESTRICT`, preventing orphaned records without explicit parent deletion

---

## Testing

Automated test suite: **not yet implemented.**

This is stated explicitly rather than omitted — there are no test files, no coverage configuration, and no CI test step at this time. Adding a test suite is the top roadmap item (see below).

**To run tests once implemented:**
```bash
bun test
```

---

## Deployment

### Current Setup

| Concern | Implementation |
|---|---|
| Runtime | Bun (`bun index.ts`) |
| Database | Neon PostgreSQL (serverless, us-east-2) — no self-managed Postgres instance |
| Frontend origin | Vercel (`https://frontend.vercel.app`) — CORS-allowed at middleware level |
| Environment config | `.env` file; variables must be injected via hosting provider's secret manager in production |

### Deploying to a PaaS (e.g. Railway, Render, Fly.io)

```bash
# Build step (Bun needs no compile step — run directly)
bun install --frozen-lockfile

# Start command
bun run start

# Migration step (run before start in CI/CD)
bunx prisma migrate deploy
```

Set `DATABASE_URL` and `PORT` as environment secrets in the hosting dashboard.

### Docker (Example)

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bunx prisma generate

EXPOSE 3005
CMD ["bun", "run", "start"]
```

> **Note:** Run `bunx prisma migrate deploy` as a separate init container or pre-start hook — do not bake migrations into the image build step.

### CI/CD

No CI pipeline is configured at this time. GitHub Actions workflow is a roadmap item.

---

## Performance & Production Notes

No production traffic data has been collected yet — this backend is in active development. The following architectural properties are present by design:

- **No N+1 queries on list endpoints**: `findMany` calls use Prisma's `include` with `take: 1` and `orderBy`, which compiles to a single SQL query with a lateral join rather than per-row subqueries
- **Connection pooling**: `@prisma/adapter-pg` shares a `pg.Pool` instance across requests rather than opening a new connection per query
- **Neon serverless pooler**: The `DATABASE_URL` points to Neon's connection pooler endpoint, adding an additional pooling layer between the API and PostgreSQL

Benchmark numbers will be added once load testing is conducted.

---

## Roadmap

- [ ] Add authentication middleware (JWT or API key) to protect all `POST` write routes
- [ ] Add input validation (Zod or express-validator) to all routes — currently no schema validation on request bodies
- [ ] Implement a test suite (Bun's built-in test runner) with route-level integration tests
- [ ] Set up GitHub Actions CI: lint → type-check → test → migrate → deploy
- [ ] Add `GET /api/categories` endpoint for category listing
- [ ] Add `GET /api/products/:id` endpoint for single-product detail view
- [ ] Add pagination (`limit` / `offset` or cursor-based) to list endpoints
- [ ] Add OpenAPI/Swagger spec (`/api/docs`)
- [ ] Structured logging (e.g. `pino`) replacing `console.log`
- [ ] Rate limiting middleware
- [ ] Docker Compose setup for local dev with a local Postgres container

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit with a conventional commit message: `git commit -m "feat: add pagination to product list"`
4. Push and open a Pull Request against `main`
5. Ensure TypeScript strict-mode passes: `bunx tsc --noEmit`

---

## License

MIT — see [LICENSE](LICENSE) for full text.
