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

**Still to decide**

| Decision | Recommendation |
|---|---|
| Database | PostgreSQL + TimescaleDB (relational + metrics in one DB) |
| Go HTTP stack | `chi` or `echo` + `sqlc` for typed SQL + `goose` migrations |
| Auth | Local email/password first, OIDC-compatible design (Keycloak / Entra later) |
| Queue | NATS (JetStream) – light, Go-native, fits per-site deployment |
| Repo layout | `backend/core` (Go), `backend/adapters/<name>` (Python), `proto/` (shared contracts) |

---

## Phase 0 – Update frontend packages ✅ (2026-11-27)

- [x] Next 15 → 16, TypeScript 5 → 7, Recharts 2 → 3, lucide 0.x → 1.x, tailwind-merge 2 → 3, React 19.3
- [x] Fix breaking changes; typecheck, build and all routes verified. Details in [docs/STATUS.md](docs/STATUS.md).

## Phase 1 – Clean up the frontend (small, safe, do first)

- [ ] Fix the hydration mismatch (React #418): make mock seed data use a fixed reference time instead of `Date.now()` at module load
- [x] Consolidate icon libraries (done 2026-11-27): replace `simple-icons` (4 logos) and `@fortawesome/free-brands-svg-icons` (AWS logo only) with `react-icons` equivalents and uninstall both. Keep lucide-react (UI), react-icons (brands), country-flag-icons (flags)
- [ ] Add a root `.gitignore` (node_modules, .next, .env*, .remember/)
- [ ] Remove the legacy `infrastructure/data-centers-and-locations` route + `data-centers-dashboard.tsx` (or redirect it to `server-sites`)
- [ ] Merge the StatCard duplicate; point all imports at one file
- [ ] Move `components/audit-logs-dashboard.tsx` and `security-overview-dashboard.tsx` into `components/security/` (or matching folders)
- [ ] Move colocated dashboards out of `app/operations/incidents` and `app/operations/runbooks` into `components/incidents` and `components/runbooks`
- [ ] Move `mocks/use*.ts` hooks into `src/hooks/`
- [ ] Rename PascalCase component files to kebab-case
- [ ] Add ESLint (flat config + `eslint-config-next`; `next lint` was removed in Next 16) and a `lint` script
- [ ] Add Vitest with first tests for `src/utils/*Stats.ts` (pure functions, easy wins)
- [ ] Add a CI workflow: install → typecheck → lint → test → build
- [ ] Move `allowedDevOrigins` in `next.config.js` to an env variable

**Done when:** typecheck, lint, tests and build pass in CI; no duplicate routes or primitives.

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

Start **Phase 1**, top of the list (hydration fix first). In parallel, settle the "Still to decide" table so Phase 2 can begin without waiting.
