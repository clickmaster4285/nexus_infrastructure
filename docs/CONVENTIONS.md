# Conventions

How code in this repo is written. Follow the existing pattern; when it conflicts with this file, this file wins for **new** code.

## Files and folders

- Routes: `app/(dashboard)/<section>/<kebab-page>/page.tsx`. Keep them thin – export `metadata` and render one component.
- Feature UI: `components/<domain>/<kebab-name>.tsx`. All component files are **kebab-case**.
- `app/` holds routes only. No components at the root of `components/`.
- Data hooks: `src/hooks/use<Name>.ts` (all of them; none in `mocks/`).
- Seed data + domain types: `src/mocks/<domain>.ts`.
- Pure logic: `src/utils/<domain>Stats.ts` or a descriptive name. No React in `utils/`.
- Internal navigation uses `next/link` `<Link>`, never a bare `<a href="/...">` (full page reload).

## Components

- Mark components `"use client"` only when they need state, effects, or browser APIs.
- Reuse before creating: `components/ui` (primitives), `components/shared` (panel, metric-card, pagination, sparkline, chart panels, badges), `components/layout` (PageHeader).
- Every page starts with `<PageHeader breadcrumbs title subtitle … />`. Put page actions in its children.
- Handle all three states from a hook: loading (skeleton), error (with Retry → `reload()`), empty, and success.

## Data hooks contract

```ts
const { items, status, reload, ...actions } = useThing(filters);
// status: "loading" | "error" | "success"
```

- The hook hides where data comes from. Today: mock store. Tomorrow: `fetch("/api/things")`. **Return shape must not change** when swapping.
- Mutations go through hook actions, never by editing mock arrays directly from a component.
- Keep an error-forcing query param (e.g. `?alertsError=1`) for new hooks so the error UI can be checked.

## Styling

- Tailwind classes + `cn()` from `@/lib/utils`.
- Use theme tokens (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `text-success`, `text-warning`, `text-destructive`, `bg-primary`) instead of literal colors where a token exists. New colors go into `globals.css` as variables for both `:root` and `.dark`.
- Avoid new inline `style={{}}`; only use it for truly dynamic values (e.g. a percentage width) that Tailwind can't express.
- Every UI must work in dark mode and on mobile (`sm`/`lg` breakpoints are used throughout).

## Charts

- Prefer **ECharts via `@/lib/echarts`** for new charts (never `import * as echarts from "echarts"` directly).
- Recharts is still in use in older pages; don't mix both libraries in one new component.

## TypeScript

- Strict mode. No `any` without a comment explaining why.
- Export domain types from the module that owns them; import with `import type`.
- Seed data must be deterministic (fixed values or a seeded generator) to avoid hydration mismatches.

## Before committing

1. `cd frontend && npm run typecheck` – must pass.
2. Load the changed page(s) in `npm run dev`, light and dark mode.
3. Commit on a feature branch; PRs target `main`.
