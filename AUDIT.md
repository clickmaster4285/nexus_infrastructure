# Enterprise Infrastructure Monitoring Audit

**Repository:** `nexus-infrastructure-monitor`  
**Audit date:** 2026-11-13  
**Scope:** source, routes, shared components, mock stores, hooks, package configuration, and typecheck output.

## Executive summary

This is a substantial Next.js App Router monitoring UI prototype. It has a coherent white dashboard visual language, many operational workflows, responsive layouts, drawers, tables, filters, charts, and seeded domain data. The current system is not yet a monitoring product: there is no backend API, collector, durable database, authentication session, authorization enforcement, time-series storage, alert evaluator, or ingestion pipeline. Most pages are mock-driven client experiences.

The best next step is to preserve the existing UI architecture while introducing a typed API boundary and a minimal real data plane. The first production slice should be: identity/RBAC, resource inventory, metric ingestion/query, alert evaluation, and audit events. Advanced APM, topology, anomaly detection, and capacity forecasting should follow that foundation.

## 1. Architecture overview

### Runtime and structure

- Next.js 15 App Router, React 19, TypeScript strict mode, Tailwind CSS.
- Route groups: Overview, Infrastructure, Monitoring, Operations, Security, plus Login and Not Found.
- Client state is primarily local React state and custom hooks.
- Charts use Recharts and ECharts; maps use Leaflet/react-leaflet.
- Shared UI exists in `components/layout`, `components/shared`, `components/ui`, and `components/logs/primitives.tsx`.
- Domain data is mostly in `src/mocks`, `src/data/mock`, and derived pure functions in `src/utils`.
- Package scripts provide `dev`, `build`, `start`, and `typecheck`; there is no test or lint script.

### Request/data flow today

`page.tsx` → dashboard component → client hook → seeded mock store → derived statistics → chart/table UI.

There are no `src/app/api` routes, server actions, database adapters, queue workers, collectors, or external monitoring integrations. Several hooks explicitly document that a future `fetch("/api/...")` can replace their mock loader.

### Important structural issue

The repository currently contains both the original `data-centers-and-locations` route/component and the newer `server-sites` route/component. Navigation points to `/server-sites`, but the duplicate legacy route and duplicate component should be consolidated after confirming the desired URL migration.

## 2. Existing feature inventory

| Module | Current implementation | Status | Main limitation |
|---|---|---|---|
| Executive Overview | KPI cards, trend charts, availability, severity/status donuts, offender tables, maintenance banner | UI + mock data | No live metrics, user-defined dashboards, drill-down query model, or dependency context |
| Infrastructure Dashboard | Topology/map, resource health, provider/environment filters, asset panels | UI + mock data | No discovery, provider APIs, topology graph backend, or inventory persistence |
| Server Sites | Site map, site summary, country/location views, performance, details/events | UI + mock data | No site entity API or live health source; duplicate old route remains |
| All Servers / Server Groups | Searchable tables, filters, detail views, metrics, processes/services/events | UI + mock data | No agent/host collector, durable history, server enrollment, or permissions |
| Network Monitoring | ECharts/Recharts dashboards, traffic, bandwidth, packet/latency views | UI + mock data | No SNMP, NetFlow, device polling, topology discovery, or interface history |
| Website & API Monitoring | Endpoint checks, latency, SSL, charts, incident/event views | UI + mock data | No synthetic scheduler, probe fleet, DNS/HTTP execution, or persisted check results |
| Database Monitoring | Database list, performance, queries, storage, connections, events | UI + mock data | No database agents/query collectors, lock/deadlock ingestion, or secure credentials |
| Metrics Explorer | Metric explorer UI and charts | UI + mock data | No metric catalog, query language, retention, rollups, or backend series query |
| Logs Explorer | Search/filter/log table/detail interactions | UI + mock data | No log ingestion, parsing, indexing, retention, or correlation IDs |
| Events Explorer | Search, event details, status transitions, linked resources | UI + mock data | No event bus/normalization, correlation engine, or durable event store |
| Alerts / Alert Rules | Filtering, acknowledgement, resolve, assign, silence, rules, drawers, timelines | Strong UI prototype + in-memory store | No evaluator, notification dispatcher, deduplication, escalation, or durable audit |
| Incidents | List/detail, timeline, severity/status, acknowledgement/escalation/resolve, postmortem fields | UI + mock data | No alert-to-incident automation, on-call integration, SLA impact, or persistence |
| Uptime & SLA | SLA KPIs, uptime calendar, error budget, downtime tables, trend | UI + derived mock data | No maintenance exclusion engine backed by real incidents, probes, or report scheduler |
| Maintenance Windows | Schedule/edit/detail, recurrence, scope, suppression, approvals, audit entries | Functional client workflow + mock store | No server-side schedule, distributed suppression, authorization, or durable audit |
| Backup & Recovery | Jobs, policies, restore points, drills, RPO/RTO, coverage, failure reasons, storage | Advanced UI + mock data | Backup execution is simulated; no provider integrations, restore execution, or immutable evidence |
| Scheduled Tasks | Task editor, schedules, task/runs tables, ECharts trend, failure cards | UI + mock data | No worker/scheduler, execution service, durable logs, or task locking |
| Security pages | Security overview, auth events, audit logs, config changes, vulnerability/cert/access pages | Mostly UI + mock data | No identity provider, RBAC enforcement, vulnerability scanner, certificate scanner, or immutable audit store |
| Cloud / Containers / Dependencies | Dedicated navigation/pages and visualizations | Mostly UI + mock data | No AWS/Azure/GCP/Kubernetes APIs, collectors, or dependency graph source |

## 3. Capability benchmark

SolarWinds Observability documents infrastructure monitoring across self-managed hosts, cloud platforms, Kubernetes, and virtual infrastructure, with entity explorers, dashboards, metrics exploration, and alerting. Its APM surface correlates service metrics, distributed traces, logs, and transaction context. These are the benchmark capabilities relevant to this project, not a request to copy SolarWinds branding or implementation.

| Capability | Existing fit | Required target capability | Priority |
|---|---|---|---|
| Infrastructure/server | Pages and mock metrics exist | Agent enrollment, host metrics, inventory, history, thresholds, health score | P0 |
| Network | Dashboard exists | SNMP v3, interface counters, latency/loss/jitter, flow data, device discovery | P1 |
| Cloud/Kubernetes | Pages exist | AWS/Azure/GCP accounts, Kubernetes collector, entity inventory, cost/capacity metrics | P1 |
| APM/traces | Not implemented | OTel ingestion, service/entity model, spans, trace/log correlation | P2 |
| Logs/events | UI explorers exist | Ingestion endpoints, parsing/indexing, correlation and retention | P0/P1 |
| Alerts | UI workflows/rules exist | Evaluator, dedupe/grouping, notifications, escalation, silence policy | P0 |
| Incidents | UI workflow exists | Alert correlation, ownership/on-call, response timeline, postmortem persistence | P1 |
| Synthetics | Website page exists | Probe workers, HTTP/DNS/SSL/API assertions, regional results | P1 |
| Database | Dashboard exists | Secure collectors and query/lock/replication metrics by engine | P1 |
| Topology/dependencies | Map/dependency pages exist | Relationship ingestion, graph model, impact propagation, root cause context | P2 |
| Analytics | Charts and derived values exist | Baselines, anomaly detection, forecasting, capacity recommendations | P2/P3 |
| Governance | Security routes exist | SSO/OIDC, RBAC, tenant boundaries, immutable audit, secrets handling | P0 |

SolarWinds' own guidance describes metrics, events, logs, and traces as complementary observability data; infrastructure monitoring alone shows trends, while correlation across these signals supports diagnosis. See [SolarWinds infrastructure monitoring documentation](https://documentation.solarwinds.com/en/success_center/observability/content/intro/infrastructure.htm), [APM documentation](https://documentation.solarwinds.com/en/success_center/observability/content/intro/services.htm), and [metrics documentation](https://documentation.solarwinds.com/en/success_center/observability/content/intro/metrics-all.htm).

## 4. Detailed gap analysis

### P0 foundational gaps

1. **No authenticated backend.** Login is a UI route; there is no session, token validation, organization boundary, or server authorization.
2. **No durable source of truth.** Module-level stores and mock hooks reset on reload and cannot support multi-user operations.
3. **No ingestion plane.** No agent, SNMP collector, cloud connector, OTel receiver, syslog/HTTP log endpoint, or event bus exists.
4. **No time-series storage.** Historical charts are derived from seeded arrays, not queried by time range, aggregation, or entity.
5. **No alert evaluation.** Rules are editable UI state; nothing evaluates thresholds/anomalies against incoming data.
6. **No notification/escalation service.** Acknowledge/resolve/silence actions do not dispatch or persist operational notifications.
7. **No audit/security enforcement.** Audit-looking entries are mock data; access-control pages do not protect routes or actions.
8. **No automated verification suite.** There is no test/lint script; typecheck currently reports unrelated Backup model/interface errors.

### P1 operational gaps

- Real host/server enrollment and agent lifecycle.
- SNMP/NetFlow and network device discovery.
- Cloud account connectors and Kubernetes collector.
- Synthetic probe scheduler and result retention.
- Log/event ingestion and indexed search.
- Alert grouping, dedupe, escalation policies, notification channels, and maintenance-aware suppression.
- Incident creation from alerts, ownership, on-call routing, and postmortem persistence.
- Backup provider adapters, restore execution, verification evidence, and immutable storage checks.
- Scheduled task worker, retries, concurrency, execution logs, and run history.
- SLA calculations backed by probes, incidents, and maintenance exclusions.

### P2/P3 advanced gaps

- OpenTelemetry traces and service maps.
- Dependency graph and blast-radius analysis.
- Baseline/anomaly detection with explainable evidence.
- Capacity forecasting and saturation alerts.
- Configuration drift and vulnerability integrations.
- Custom dashboards and saved queries backed by tenant-scoped APIs.
- Multi-region collectors, HA, retention tiers, and archive/export.

## 5. UI/UX audit

### Strengths

- Shared `PageHeader`, `PageMeta`, `PageHeading`, `StatCard`, `MetricCard`, `Card`, `ChartCard`, `Panel`, badges, drawers, filters, and pagination are already present.
- Consistent rounded cards, muted dashboard palette, status colors, responsive grids, and loading/error/empty states appear across most modules.
- Alert, incident, maintenance, backup, and task workflows have meaningful detail drawers and action menus.

### Inconsistencies to resolve

- Two StatCard implementations exist (`components/ui/StatCard.tsx` and `components/shared/stat-card.tsx`) with overlapping responsibilities.
- Recharts and ECharts wrappers are implemented in multiple page files rather than one typed chart adapter.
- Some pages use `PageMeta + PageHeading`, others `PageHeader`; action placement semantics need one documented contract.
- Static `style={{ width: ... }}` bar widths remain in several cards despite the Tailwind-only design rule.
- File/folder casing is inconsistent (`TasksKpiRow.tsx`, `StatCard.tsx` vs kebab-case components).
- The server-sites rename left a legacy data-centers route/component alongside the new route.
- No centralized theme tokens for chart series/status colors; colors are repeated as literals.
- No automated visual/accessibility regression coverage.

### Reusable component strategy

1. Keep one `PageHeader` contract: breadcrumb/meta controls in the meta row and title-row actions as children.
2. Consolidate to one `StatCard` implementation and make `MetricCard` a typed data adapter.
3. Add one `EChart` wrapper with ResizeObserver, theme resolution, export/table/fullscreen affordances, and typed event callbacks.
4. Centralize `StatusMeta` for success/failed/skipped/running/warning/critical tones and icons.
5. Create typed `DataTable`, `FilterBar`, `EmptyState`, `ErrorState`, and `DrawerHeader` primitives only where current duplication is demonstrated.

## 6. Backend target architecture

```text
Collectors / integrations
  ├─ host agent, SNMP, cloud, Kubernetes, OTel, synthetic probes, backup adapters
  └─ authenticated ingest gateway
        ├─ validation + tenant/resource identity
        ├─ event/alert evaluation worker
        ├─ queue (retry/dead-letter/backpressure)
        └─ storage
             ├─ relational DB: users, RBAC, resources, rules, incidents, audit
             ├─ time-series store: metrics and rollups
             ├─ log/event index: structured search and retention
             └─ object storage: exports, large logs, backup evidence
```

Recommended API boundaries:

- `GET /api/resources`, `/api/resources/:id`, `/api/resources/:id/metrics`
- `POST /api/ingest/metrics`, `/api/ingest/logs`, `/api/ingest/events`
- `GET/POST/PATCH /api/alerts`, `/api/alert-rules`, `/api/incidents`
- `GET/POST/PATCH /api/maintenance-windows`
- `GET/POST /api/synthetic-checks`, `/api/backup-jobs`, `/api/scheduled-tasks`
- `GET /api/audit`, `/api/users`, `/api/roles`, `/api/integrations`

Every endpoint must enforce tenant scope, validate payloads, record actor/audit context, and return stable typed error envelopes. Replace mock hooks behind the same interfaces so UI migration is incremental.

## 7. Prioritized roadmap

| Priority | Feature | Problem solved | Complexity | Acceptance criteria |
|---|---|---|---|---|
| P0 | Identity + RBAC | Prevents untrusted access and enables ownership | L | OIDC/session, protected routes, server-side role checks, audit |
| P0 | Resource inventory API | Replaces module-level resource mocks | M | CRUD, health state, tags, ownership, pagination, detail endpoint |
| P0 | Metrics ingest/query | Makes dashboards real | L | Authenticated ingest, time-range query, rollups, retention |
| P0 | Alert evaluator + persistence | Makes rules actionable | L | Threshold evaluation, state transitions, dedupe, silence, audit |
| P0 | Notification service | Delivers operational response | M | Email/Slack/webhook adapter, retries, escalation policy |
| P0 | CI/type/test baseline | Prevents regressions | M | Typecheck clean, lint, unit tests for stats/rules, route smoke tests |
| P1 | Host/server agent | Provides CPU/memory/disk/process/service data | L | Enrollment, heartbeat, metric batches, offline detection |
| P1 | Logs/events pipeline | Enables search and correlation | L | Structured ingestion, indexing, time/resource filters, retention |
| P1 | Network/cloud/K8s connectors | Covers enterprise infrastructure | XL | Connector health, credentials, normalized entities/metrics |
| P1 | Incident/on-call workflow | Reduces MTTR | L | Alert-to-incident, owner, escalation, timeline, postmortem |
| P1 | Synthetic checks + SLA | Makes uptime reports trustworthy | M | Probe schedule, assertions, region results, maintenance exclusion |
| P1 | Backup/task workers | Separates monitoring UI from execution reality | L | Queue, retries, locking, logs, restore/drill evidence |
| P2 | OTel APM/traces | Adds application causality | XL | OTLP ingest, services/spans, trace/log correlation, service map |
| P2 | Dependency graph/RCA | Shortens investigation | L | Relationship model, blast radius, correlated evidence |
| P2 | Baselines/anomalies | Detects abnormal behavior | L | Explainable baseline, anomaly event, alert integration |
| P3 | Forecasting/capacity | Supports proactive planning | L | Forecast intervals, saturation date, recommendation workflow |
| P3 | HA/scale/retention tiers | Supports enterprise operating scale | XL | Collector HA, queue backpressure, partitioning, archive policy |

## 8. Implementation order

1. Freeze the UI contract and consolidate duplicated shared primitives.
2. Add a backend package/service with identity, tenant, resources, alerts, and audit schema.
3. Introduce typed API clients and replace one vertical slice (server inventory → metrics → alert → incident).
4. Add ingestion workers and time-series query support; migrate Executive Overview and Server Details.
5. Add logs/events and correlation, then network/cloud/Kubernetes connectors.
6. Migrate backups and scheduled tasks to worker-backed execution.
7. Add OTel/APM, topology/RCA, anomaly detection, and forecasting.

## 9. Verification baseline

- `npm run typecheck` was run during the audit. It currently reports pre-existing Backup model/interface errors (`immutability`, `assetId`, backup tab prop mismatches, and missing `STORAGE_LOCATIONS` export). These must be resolved before CI can be trusted.
- `package.json` has no lint or test script. Add ESLint and a test runner only after agreeing the project’s preferred tooling; do not add them as a UI-only patch.
- Manual route smoke checks should cover loading, error, empty, filters, drawers, keyboard focus, dark mode, and mobile layout for every module.

## 10. What was changed during this audit

No new product feature implementation was started from this audit brief. This document records the current state, benchmark, gaps, architecture target, and implementation order. Existing working-tree changes from earlier tasks remain present and should be reviewed separately before merging.

## Remaining limitations and dependencies

- A real monitoring system requires credentials, agents/collectors, backend services, storage, queueing, and operational deployment choices that are not present in this repository.
- SolarWinds capabilities are used as a public functional benchmark only. This audit does not copy proprietary code or branding.
- Backend implementation should be approved as a separate workstream after the P0 scope is selected.
