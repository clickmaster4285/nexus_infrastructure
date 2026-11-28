# Backend guide

_Last updated: 2026-11-28_

How the Nexus backend is structured, what each tool is for, and when to install things.
Written for people who know MERN (Express + React) and are learning the Go stack.

Roadmap context: [PLAN.md](../PLAN.md). High-level system diagram: [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Current status

| Piece | Status |
|---|---|
| `frontend/` | Next.js app on mock data |
| `backend/` | Not scaffolded yet (only a scratch `hello.go` may exist) |
| Database / Docker Compose | Not started |
| Auth, API, migrations | Phase 2 – not started |

We install tools and libraries **one step at a time**, only when the current task needs them.

---

## MERN → Nexus backend map

If you know Express, use this table:

| MERN (Express) | Nexus Go | Role |
|---|---|---|
| `backend/server.js` | `backend/core/cmd/server/main.go` | Process entry point (`main`) |
| `backend/package.json` | `backend/core/go.mod` | Module name + dependency list |
| `node_modules/` | module cache (`$GOPATH/pkg/mod`) | Downloaded packages (not committed) |
| `npm install` | `go mod tidy` / `go get` | Resolve and download deps |
| `npm start` / `node server.js` | `go run ./cmd/server` | Run the API |
| `backend/routes/` | `backend/core/internal/api/` | URL → handler wiring |
| `backend/controllers/` | handlers in `internal/api/` | Request logic (often same package as routes) |
| `backend/middleware/` | chi middleware under `internal/api/middleware/` | Auth, logging, CORS, etc. |
| `backend/models/` + ORM | SQL in `internal/db/queries/` + **sqlc** generated Go | Typed DB access (no GORM) |
| Prisma / Knex migrate | **goose** under `backend/core/migrations/` | Schema versioning |
| `.env` | `.env` + `.env.example` | Config (never commit secrets) |
| MongoDB / Atlas | PostgreSQL + **TimescaleDB** (Docker) | App data + time-series metrics |
| `frontend/` React | `frontend/` Next.js | Already exists |

**Mental model**

- `go.mod` ≈ `package.json`
- One compiled binary ≈ running `node server.js`
- Go has **no runtime `require()`** of loose folders the same way Node does: you import packages; the compiler builds one binary.

---

## Target folder structure

Grow this tree as Phase 2 progresses. Empty folders are fine until the feature lands.

```
NexusInfra/
├── frontend/                      # Next.js UI (existing)
├── backend/
│   ├── core/                      # Go API – the “Express app”
│   │   ├── cmd/
│   │   │   └── server/
│   │   │       └── main.go        # entry point ≈ server.js
│   │   ├── internal/              # private app code (not importable by others)
│   │   │   ├── api/               # HTTP routes + handlers ≈ routes/
│   │   │   │   └── middleware/    # auth, logging, … (later)
│   │   │   ├── auth/              # sessions, password hashing (later)
│   │   │   └── db/                # sqlc: queries + generated code (later)
│   │   ├── migrations/            # goose SQL files (later)
│   │   ├── go.mod                 # ≈ package.json
│   │   └── go.sum                 # locked checksums (like package-lock)
│   └── adapters/                  # Python device services (Phase 4+)
│       └── <name>/                # one small service per adapter
├── proto/                         # gRPC contracts Go ↔ Python (later)
├── docker-compose.yml             # Postgres/Timescale (+ NATS later)
├── .env.example                   # documented env vars
└── docs/
    └── BACKEND.md                 # this file
```

### Why `cmd/` and `internal/`?

| Path | Meaning |
|---|---|
| `cmd/server/` | **Runnable** programs. One folder per binary. `main` package lives here. |
| `internal/` | App libraries that other Go modules **cannot** import. Keeps the public surface small. |
| `migrations/` | Plain SQL (or Go) migration files owned by goose. |

This is idiomatic Go layout, not a random Nest/Express clone — but the **roles** match what you already know.

---

## Decided stack (what each piece is)

From [PLAN.md](../PLAN.md): **chi · sqlc · goose · PostgreSQL/TimescaleDB · NATS (later)**.

### Runtime libraries (added with `go get` inside `backend/core`)

| Library | Install when | What it does |
|---|---|---|
| **chi** (`go-chi/chi`) | First real HTTP routes | Lightweight router on stdlib `net/http`. Like Express `Router`, thinner than Nest. |
| **pgx** | First DB connection | Postgres driver used with sqlc. |
| **godotenv** (optional) | When `.env` loading is needed | Load env files in local dev. |

We are **not** using Gin, Echo, or GORM for the core (unless the plan changes).

### Host CLI tools (installed once with `go install`)

| Tool | Install when | What it does |
|---|---|---|
| **sqlc** | First typed SQL queries | You write SQL → generates type-safe Go. Opposite of an ORM (SQL stays explicit). |
| **goose** | First schema change | Runs versioned migrations (`up` / `down`). Like Prisma migrate / Knex / Flyway. |

```bash
go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
go install github.com/pressly/goose/v3/cmd/goose@latest
```

Binaries land in `$(go env GOPATH)/bin` (usually `~/go/bin`). Ensure that directory is on your `PATH`.

### Infra via Docker Compose (not installed on the host)

| Service | Image (typical) | When |
|---|---|---|
| **PostgreSQL + TimescaleDB** | `timescale/timescaledb` | When we need a real DB |
| **NATS JetStream** | `nats` with JetStream | When async jobs arrive |

Use `docker compose` (plugin). Do **not** install a local Postgres server unless you have a reason.

### Later (do not install now)

| Tool | Phase |
|---|---|
| `protoc` / `buf` | Protobuf + Python adapters |
| `nats` CLI | Debugging JetStream |
| `air` | Optional Go hot reload |
| Python Netmiko / NAPALM / Scrapli | Network device adapters |

---

## Go vs “Golang”

| | |
|---|---|
| Official name | **Go** |
| Nickname | **Golang** (search-friendly; site is golang.org) |
| Same language? | Yes |

---

## chi vs gin vs echo (why chi)

| | **chi** | **gin** | **echo** |
|---|---|---|---|
| Style | Thin, stdlib-compatible | Batteries-included | Middle ground |
| Nexus | **Chosen** | Not used | Was an alternative |

chi composes well with standard `net/http` middleware and stays close to plain Go.

---

## goose vs gorm vs sqlc

| Tool | Job |
|---|---|
| **goose** | Change schema over time (migrations) |
| **GORM** | ORM – talk to DB via Go structs (we are **not** using this for core) |
| **sqlc** | Write SQL → generate typed Go functions |

Together for Nexus: **goose** migrates schema → you write SQL queries → **sqlc** generates the Go you call from handlers.

---

## TimescaleDB

PostgreSQL extension for **time-series** data (metrics, heartbeats, latency over time).

- Same SQL/joins/tools as Postgres
- Adds hypertables, retention, continuous aggregates
- Nexus plan: **one database** for app tables (users, devices, incidents) **and** metrics

---

## How a request will flow (target)

```
Browser / Next.js hook
  → GET /api/...
Go (chi router in internal/api)
  → auth middleware (session cookie)
  → handler
  → sqlc-generated query (pgx → Postgres/Timescale)
  → JSON response (same shape the frontend hooks already expect)
```

Frontend hooks are written so the body can later become `fetch("/api/...")` **without changing the return shape**. Preserve that contract.

Python adapters (later) sit **beside** the Go core, talk gRPC, and are small/stateless. Go must tolerate adapter downtime (retry / degrade / alert). See PLAN.md guardrails.

---

## Install-as-you-go checklist

Do **not** install everything up front.

| Step | Need | Action |
|---|---|---|
| 1. Hello HTTP server | Go only (already installed) | Scaffold `backend/core`, `main.go` listening on a port |
| 2. Real routes | **chi** | `go get` chi inside the module |
| 3. Database | Docker Compose + Timescale image | `docker compose up` |
| 4. Schema | **goose** CLI + migration files | `go install` goose, write SQL, migrate |
| 5. Queries | **sqlc** CLI + `sqlc.yaml` + SQL | `go install` sqlc, generate Go |
| 6. Auth / OpenAPI / proto | as Phase 2 items land | per PLAN.md |

---

## Prerequisites already expected on the machine

| Tool | Notes |
|---|---|
| Go (≥ 1.22 recommended; project machines may be newer) | `go version` |
| Docker + `docker compose` | For Postgres/Timescale |
| `psql` client (optional) | Handy for inspecting the DB |
| Node 20+ / npm | Frontend only |
| Python 3 | Adapters later |

### If `go install` fails with `sum.golang.org` / DNS timeout

That is a **network/DNS** problem (often `127.0.0.53` not resolving), not a bad package name.

```bash
# Diagnose
getent hosts proxy.golang.org
getent hosts sum.golang.org

# After DNS works:
go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
go install github.com/pressly/goose/v3/cmd/goose@latest
```

Temporary workaround only if the module proxy works but the checksum DB does not:

```bash
GOSUMDB=off go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
```

Prefer fixing DNS over leaving `GOSUMDB=off` permanently.

---

## Common commands (once scaffolded)

Run from `backend/core/` unless noted.

| Command | Purpose |
|---|---|
| `go run ./cmd/server` | Start API (dev) |
| `go build -o bin/server ./cmd/server` | Build binary |
| `go mod tidy` | Sync `go.mod` / `go.sum` with imports |
| `go get github.com/go-chi/chi/v5` | Add chi when routes start |
| `sqlc generate` | Regenerate typed query code |
| `goose -dir migrations postgres "$DATABASE_URL" up` | Apply migrations |
| `docker compose up -d` | Start DB (from repo root, when Compose exists) |

Exact goose flags and Compose service names will be filled in when those files are added.

---

## Related docs

| Doc | Contents |
|---|---|
| [PLAN.md](../PLAN.md) | Phases, decided stack, next actions |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Frontend wiring + target backend diagram |
| [STATUS.md](STATUS.md) | What exists / what is broken |
| [CONVENTIONS.md](CONVENTIONS.md) | Frontend coding rules |
| [CLAUDE.md](../CLAUDE.md) | Quick repo orientation for agents/humans |
