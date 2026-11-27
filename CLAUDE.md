# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

## What this is

**Nexus** is an infrastructure monitoring dashboard (servers, network, monitoring, alerts, incidents, backups, security).
Today it is a **frontend-only prototype**: every page runs on seeded mock data. There is no backend yet.

```
NexusInfra/
├── frontend/   Next.js 15 app (all current code lives here)
├── backend/    EMPTY – reserved for the API/data plane (see PLAN.md)
├── docs/       ARCHITECTURE.md, STATUS.md, CONVENTIONS.md
├── PLAN.md     Roadmap and the next work to pick up
└── CLAUDE.md   This file
```

Read before starting work:
- [PLAN.md](PLAN.md) – what we are doing next
- [docs/STATUS.md](docs/STATUS.md) – what exists and what is broken or duplicated
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) – how the frontend is wired
- [docs/CONVENTIONS.md](docs/CONVENTIONS.md) – coding rules to follow
- [frontend/AUDIT.md](frontend/AUDIT.md) – the full product/gap audit from 2026-11-13

## Commands (run from `frontend/`)

| Command | Purpose |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Dev server on http://localhost:3000 (`/` redirects to `/overview/executive`) |
| `npm run typecheck` | `tsc --noEmit` with TypeScript 7 (fast). |
| `npm run build` | Production build |

**Before every commit: `npm run typecheck` must pass.** No lint, tests or CI for now (removed on purpose, 2026-11-27; may return later).

## Stack

**Frontend:** Node ≥ 20.9 (dev machine: 22) · Next.js 16 (App Router, Turbopack) · React 19.3 · TypeScript 7 (strict, native Go compiler) · Tailwind CSS v4 (CSS-first config in `src/app/globals.css`, no tailwind.config) · tailwind-merge 3 · shadcn-style primitives (Radix) · Recharts 3 + ECharts 6 · Leaflet / react-leaflet · lucide-react 1.x. Path alias `@/*` → `frontend/src/*`.

**Backend (planned, not started):** Go core (API, inventory, scheduler, auth/RBAC, audit) + small stateless Python services for network device adapters (Netmiko/NAPALM/SNMP), talking over gRPC. See [PLAN.md](PLAN.md).

### Version gotchas
- **Next 16:** `next lint` no longer exists. Route middleware file is `proxy.ts`, not `middleware.ts`. After switching versions, `rm -rf .next` (a stale cache caused a fake prerender failure).
- **Recharts 3:** `Pie` has no `activeIndex`/`activeShape` – use `shape={(props, index) => …}` and `props.isActive`. Tooltip `formatter` values are `ValueType | undefined`, not `number`.
- **Icons – only these three:** `lucide-react` for UI icons · `react-icons` (`react-icons/si`, `react-icons/fa`) for brand/tech logos (lucide 1.x has no brand icons) · `country-flag-icons` for flags. Don't add another icon library.
- **TypeScript 7 only:** plain `typescript@7`. Don't add `typescript-eslint`/ESLint TS rules – they need the TS 6 API and would force a TS 6 alias. (Was: `@typescript/native` (= TS 7) provides `tsc`; the `typescript` package is aliased to `@typescript/typescript6` because typescript-eslint and Next's build need the TS 6 JS API (TS 7.0 has none). Don't "fix" this alias. Removed.)
- **Line endings:** many source files are CRLF. Keep them that way – don't rewrite whole files with tools that normalise to LF.

## How a page works (the one pattern to know)

```
src/app/(dashboard)/<section>/<page>/page.tsx   thin server file: metadata + render one component
  → src/components/<domain>/<x>-dashboard.tsx    "use client" UI
    → src/hooks/useX.ts                          async mock "fetch" with loading/error/success
      → src/mocks/<domain>.ts                     seeded data + module-level store (subscribe/snapshot/mutate)
      → src/utils/<domain>Stats.ts                pure derived calculations (KPIs, trends)
```

Hooks are written so their body can later be swapped for `fetch("/api/...")` **without changing the return shape**. Preserve that contract.

## Rules

- Keep `page.tsx` files thin. `app/` holds routes only; UI goes in `src/components/<domain>/` (kebab-case file names).
- Data hooks live in `src/hooks/`; seed data + domain types in `src/mocks/`; pure logic in `src/utils/`.
- New nav entries go in `src/config/navigation.ts` (single source for the sidebar and `hrefForLabel`).
- Use `PageHeader` (`components/layout/page-header.tsx`) for page titles/breadcrumbs.
- Use `cn()` from `@/lib/utils` for class merging; use theme tokens (`bg-card`, `text-muted-foreground`, `text-success`, …) not raw colors where a token exists.
- ECharts must be imported from `@/lib/echarts` (it converts `oklch()` colors; raw `echarts` renders invisible series).
- Mock data must stay deterministic (no `Math.random()` at module load for seeded data) so SSR and client agree.
- Do not add new duplicate primitives – check `components/ui` and `components/shared` first.
- Full details: [docs/CONVENTIONS.md](docs/CONVENTIONS.md).

## Git

- Work on feature branches; `main` is the PR target. Current working branch: `change26/11`.
- `frontend/.gitignore` exists; the repo root has none (`.remember/` is untracked tooling state – don't commit it).
