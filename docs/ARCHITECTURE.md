# Architecture

## Current (frontend only)

```
Browser
 └─ Next.js App Router (frontend/src/app)
     ├─ layout.tsx                 root <html>, fonts/globals.css, metadata
     ├─ login/page.tsx             standalone login screen (no auth)
     ├─ not-found.tsx
     └─ (dashboard)/               route group; every page gets the shell
         ├─ layout.tsx  → DashboardShell (Sidebar + Header + theme toggle)
         ├─ page.tsx    → redirect("/overview/executive")
         └─ overview | infrastructure | monitoring | operations | members | security
```

### Shell

- `components/layout/dashboard-shell.tsx` – client component. Holds dark-mode state (persisted in `localStorage` key `nexus-theme`, light by default) and the mobile sidebar toggle. Dark mode is a `.dark` class on a wrapper div.
- `components/layout/sidebar.tsx` – renders `NAV_GROUPS` from `config/navigation.ts`.
- `components/layout/header.tsx` – top bar (menu, theme toggle, etc.).
- `components/layout/page-header.tsx` = `PageMeta` (breadcrumbs, demo badge, refresh/last updated) + `PageHeading` (icon, title, subtitle, status badge, actions).

### Data flow per page

```
page.tsx (server, ~11 lines: metadata + <XDashboard/>)
  └─ components/<domain>/x-dashboard.tsx  ("use client")
       ├─ useX()  hook  ── src/hooks/*.ts
       │    • simulates async load (200–400 ms) → status: loading | error | success
       │    • `?<name>Error=1` query param forces the error state for testing
       │    • exposes actions (acknowledge, resolve, create, …) that mutate the store
       │
       ├─ src/mocks/<domain>.ts
       │    • seeded, deterministic sample data + TypeScript domain types
       │    • module-level store: getXSnapshot() / subscribeX() / mutateX()
       │      (shared across pages in one browser session, lost on reload)
       │
       └─ src/utils/<domain>Stats.ts   pure functions: KPIs, trends, grouping, schedules
```

Domain types are currently defined **inside the mock files** (e.g. `type Alert` in `mocks/alerts.ts`). When the backend arrives these should move to a shared types module.

### Folder map (`frontend/src`)

| Folder | Contents |
|---|---|
| `app/` | Routes only |
| `components/ui/` | shadcn-style primitives: button, badge, card, dialog, input, select, tabs, stat-card |
| `components/shared/` | Cross-domain pieces: panel, metric-card, pagination, sparkline, donut/chart panels, icon, provider-logo, country-flag, badges, run-log-viewer |
| `components/layout/` | Shell, sidebar, header, page header/meta/heading, footer |
| `components/<domain>/` | One folder per feature (alerts, backups, servers, monitoring, …) |
| `config/navigation.ts` | Sidebar groups + `hrefForLabel()` |
| `hooks/` | All data hooks (`use*.ts`) |
| `mocks/` | Seed data, domain types, in-memory stores |
| `utils/` | Pure calculation/formatting helpers |
| `lib/` | `cn()`, `echarts.ts` (oklch-safe ECharts wrapper), `slaCalculations.ts` |
| `public/` | Logo, DB icons, login hero video/poster |

### Styling

- Tailwind v4, configured in `app/globals.css` (`@theme inline`, `@custom-variant dark`).
- Design tokens are CSS variables in `oklch()` for light and dark: background, card, primary, muted, success, warning, destructive, sidebar-*.
- Fonts: DM Sans / Manrope / Plus Jakarta Sans via Google Fonts import.

### Charts and maps

- **Recharts** and **ECharts** are both used. ECharts must come from `@/lib/echarts`, which converts `oklch()` colors to `rgba()` before rendering.
- **Leaflet** (react-leaflet) for site/location maps — must be client-only.

## Target (planned)

Stack: **Go core** (API, inventory, scheduler, polling, auth/RBAC, audit) + **stateless Python services** for network device adapters (Netmiko/NAPALM/Scrapli, SNMP), connected by gRPC and NATS. Diagram and guardrails: [PLAN.md](../PLAN.md#backend-stack--decided-go-core--python-services). Functional design: [frontend/AUDIT.md §6](../frontend/AUDIT.md).

```
Collectors (host agent, Python device/SNMP adapters, cloud, K8s, OTel, synthetic probes)
  → authenticated ingest API  (backend/core, Go)
      → validation + tenant/resource identity
      → alert evaluator / workers (queue with retries)
      → storage: relational DB (users, RBAC, resources, rules, incidents, audit)
                 time-series store (metrics) · log/event index · object storage
  ← REST API  /api/resources, /api/alerts, /api/incidents, …
  ← frontend hooks swap mock loaders for fetch() with the same return shapes
```
