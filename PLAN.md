# PLAN

_Last updated: 2026-11-27_

## Where we are

A complete-looking monitoring **UI prototype** (64 routes) runs entirely on mock data in `frontend/`. `backend/` is empty. Details: [docs/STATUS.md](docs/STATUS.md).

## Goal

Turn the prototype into a working product **one vertical slice at a time**, without rewriting the UI. The frontend hooks are already built to swap mock loaders for real API calls.

## Backend stack – decided: Go core + Python services

```
                 ┌──────────────── Next.js frontend ────────────────┐
                 │  hooks → fetch("/api/...") (same return shapes)   │
                 └──────────────────────┬───────────────────────────┘
                                        │ REST (OpenAPI)
┌───────────────────────────── Go core (single static binary) ─────────────────────────────┐
│ API server · auth/RBAC · audit log · site & device inventory · scheduler / job queue      │
│ concurrent health checks & polling · alert evaluator · mass config pushes                 │
└───────────────┬──────────────────────────────────────────────┬───────────────────────────┘
                │ gRPC (versioned protobuf)                     │ NATS (async jobs)
┌───────────────┴──────────── Python services (stateless, containerised) ──────────────────┐
│ network device adapters (Netmiko / NAPALM / Scrapli) · SNMP collectors · config parsers   │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

**Guardrails**
1. Python services are small, stateless, one job each, containerised with health checks.
2. Contracts are versioned: protobuf for Go↔Python, OpenAPI for Go↔frontend (generate TS types from it).
3. Go must handle Python downtime gracefully (retry / degrade / raise an alert).
4. Never shell out from Go to Python scripts on the hot path.
5. If Python grows past ~60% of the backend, revisit the split.

**Decided (2026-11-27)**

| Area | Choice |
|---|---|
| Database | PostgreSQL + TimescaleDB (app data + metrics in one DB) |
| Go stack | `chi` router · `sqlc` (typed Go from SQL) · `goose` migrations |
| Auth | Email + password (argon2id/bcrypt), server-side sessions in HTTP-only cookies; OIDC-ready design |
| Queue | NATS JetStream (when async jobs arrive) |
| Repo layout | `backend/core` (Go), `backend/adapters/<name>` (Python), `proto/` (shared contracts) |

---|---|
| Database | PostgreSQL + TimescaleDB (relational + metrics in one DB) |
| Go HTTP stack | `chi` or `echo` + `sqlc` for typed SQL + `goose` migrations |
| Auth | Local email/password first, OIDC-compatible design (Keycloak / Entra later) |
| Queue | NATS (JetStream) – light, Go-native, fits per-site deployment |
| Repo layout | `backend/core` (Go), `backend/adapters/<name>` (Python), `proto/` (shared contracts) |

---

## Phase 0 – Update frontend packages ✅ (2026-11-27)

- [x] Next 15 → 16, TypeScript 5 → 7, Recharts 2 → 3, lucide 0.x → 1.x, tailwind-merge 2 → 3, React 19.3
- [x] Fix breaking changes; typecheck, build and all routes verified. Details in [docs/STATUS.md](docs/STATUS.md).

## Phase 1 – Clean up the frontend ✅ (2026-11-27)

- [x] Fix the hydration mismatch (React #418): cause was the clock-based "Last updated" label (build-time HTML vs browser time); fixed once in `PageMeta` with `suppressHydrationWarning`
- [x] Consolidate icon libraries: lucide-react (UI), react-icons (brands), country-flag-icons (flags); removed simple-icons + FontAwesome
- [x] Add a root `.gitignore` (env files, editor/OS files, `.remember/`, future Go/Python build output)
- [x] Remove the legacy `data-centers-and-locations` route and its duplicate dashboard (no redirect; nothing linked to it)
- [x] Merge the StatCard duplicate → `components/ui/stat-card.tsx`
- [x] Move root dashboards into `components/audit-logs/` and `components/security-overview/`
- [x] Move dashboards out of `app/` into `components/incidents/` and `components/runbooks/` (`app/` now holds routes only)
- [x] Move `mocks/use*.ts` hooks into `src/hooks/`
- [x] Rename 30 PascalCase component files to kebab-case (`git mv`, history kept)
- [x] Fixed `<a>`→`<Link>` for internal links, removed `any` types, escaped JSX entities
- [x] ~~ESLint, Vitest tests, CI workflow~~ – added then **removed on purpose** (keep plain TypeScript 7; no CI/testing for now)
- [x] Move `allowedDevOrigins` to the `ALLOWED_DEV_ORIGINS` env variable (`.env.example` added)

**Done:** typecheck and build pass; no duplicate routes or primitives.

## Phase 1.5 – Follow-ups (can run alongside Phase 2)

- [ ] (Later, when wanted) Re-add linting, unit tests and CI. Note: ESLint TS rules need the TS 6 API until typescript-eslint supports TS 7.1+
- [ ] Remove ~400 unused imports/variables
- [ ] Single typed `EChart` wrapper; migrate remaining Recharts charts to ECharts (one chart library)
- [ ] Replace inline `style={{}}` bar widths where Tailwind can express them

## Phase 2 – Backend foundation

- [ ] Scaffold `backend/core` (Go module), `.env.example`, Docker Compose with Postgres/TimescaleDB + NATS
- [ ] OpenAPI spec as the API contract; generate TS types for the frontend (replaces types in `frontend/src/mocks/*`)
- [ ] `proto/` folder + first protobuf contract for a Python adapter (stub service with health check)
- [ ] Database schema + migrations: organizations, users, roles, resources (servers/devices/sites), audit_events
- [ ] Auth: login/logout/session, password hashing, protected API routes
- [ ] Frontend: real login, a Next.js `proxy.ts` (Next 16's name for middleware) that redirects unauthenticated users to `/login`
- [ ] Typed API client in `frontend/src/lib/api.ts` with a standard error envelope
- [ ] Seed script that loads current mock data into the DB (so the UI looks the same)

**Done when:** a user can log in and the All Servers + Server Details pages load from the API.

## Phase 3 – First vertical slice: server → metrics → alert → incident

- [ ] `GET /api/resources`, `/api/resources/:id`
- [ ] Metrics ingest `POST /api/ingest/metrics` + query `GET /api/resources/:id/metrics?from&to&step`
- [ ] Minimal host agent (or a script pushing metrics) to produce real data
- [ ] Alert rules CRUD + an evaluator worker (threshold rules, dedupe, state changes)
- [ ] Alerts API (list, acknowledge, resolve, assign, silence) – swap `useAlerts` / `useAlertRules`
- [ ] Incidents API – swap `useIncidents`; create an incident from an alert
- [ ] Every mutation writes an audit event; Audit Logs page reads it
- [ ] Notifications: email/webhook adapter

**Done when:** a real host reporting high CPU fires an alert visible on the Alerts page, can be escalated to an incident, and appears in the audit log.

## Phase 4 – Broaden data sources

Maintenance windows (with alert suppression) · synthetic HTTP/SSL checks + real SLA reports · logs and events ingestion/search · scheduled tasks and backup workers · **network devices via Python adapters** (Netmiko/NAPALM for SSH/CLI, SNMP collector) behind gRPC · cloud and Kubernetes connectors (Go).

## Phase 5 – Advanced

OpenTelemetry traces/APM · dependency graph and root-cause analysis · anomaly detection and baselines · capacity forecasting · custom dashboards · multi-tenant hardening, HA and retention tiers.

---

## Next action

Start **Phase 2**, step 1: scaffold `backend/core` (Go + chi), Docker Compose with Postgres/TimescaleDB, `.env.example`.
