# Project Status

_Snapshot: 2026-11-27, branch `change26/11`._

## Summary

- **Frontend:** large, polished UI prototype. 64 routes, ~317 source files, ~12k lines of mock data. Typecheck passes.
- **Backend:** `backend/` is an empty folder. No API, database, auth, ingestion or workers exist.
- **Data:** 100% mock. All state lives in browser memory and resets on reload.
- **Quality gates:** `npm run typecheck` only. No lint, no tests, no CI.

## Recent history

| Commit | Change |
|---|---|
| `f4e9366` "hamza code" | Initial import of the Next.js app at the repo root |
| `65e8042` | Moved the app into `frontend/` and created an empty `backend/` |

## Module inventory

Status key: **UI** = page built on mock data · **UI+** = interactive workflows (create/edit/actions) on an in-memory store.

| Section | Pages | Status |
|---|---|---|
| Overview | Executive, Infrastructure Dashboard, Live Operations/NOC, Global Health | UI |
| Infrastructure | Server Sites, All Servers, Server Details/[id], Server Groups, Network Devices, Network Topology, Containers & Docker, Cloud Accounts, Dependencies | UI |
| Monitoring | Metrics Explorer, CPU & Memory, Disk & Storage, Network, Processes & Services, Website & API, Database, Logs Explorer, Events Explorer/[id], Uptime & SLA, Capacity Planning/[id], Monitoring Templates/[id] | UI |
| Operations | Alerts, Alert Rules, Alert Correlation, Incidents (list/new/[id]), Maintenance Windows (list/new/[id]/edit), Scheduled Tasks, Backups & Recovery (+ jobs/[id]), Runbooks (list/[id] editor + runner) | UI+ |
| Members | Members, Member/[id] | UI |
| Security | Overview, Auth Events/[id], Audit Logs/[id], Config Changes/[id], Vulnerability & Patch (CVE/[id], servers/[id]), Certificates/[id], Access Control (users/[id], roles/[id]) | UI |
| Auth | `/login` | UI only – no session; sign-in just navigates to the dashboard |

## Known issues and tech debt

| # | Issue | Where |
|---|---|---|
| 1 | **Duplicate route:** legacy `data-centers-and-locations` still exists next to its replacement `server-sites` (nav points to server-sites) | `app/(dashboard)/infrastructure/data-centers-and-locations/`, `components/infrastructure/data-centers-dashboard.tsx` |
| 2 | **Two StatCards:** `components/shared/stat-card.tsx` is just a re-export of `components/ui/StatCard.tsx` | components/ui, components/shared |
| 3 | **Two chart libraries:** Recharts (~30 files) and ECharts (~43 files); chart wrappers are re-implemented per page | across components |
| 4 | **314 inline `style={{…}}`** usages (mostly bar widths) | across components |
| 5 | **Inconsistent placement:** some dashboards live in `app/` next to `page.tsx` (incidents, runbooks), two live at `components/` root (`audit-logs-dashboard.tsx`, `security-overview-dashboard.tsx`) | see paths |
| 6 | **Mixed file casing:** `StatCard.tsx`, `JobDetail.tsx`, `TasksKpiRow.tsx` vs kebab-case elsewhere | components |
| 7 | **Hooks split across two folders:** `src/hooks/` and `src/mocks/use*.ts` | hooks, mocks |
| 8 | Very large files (several dashboards 800–1000+ lines; `components/monitoring` ≈ 10.6k lines in 20 files) | components/monitoring, backups, maintenance-windows |
| 9 | No auth / route protection; Access Control pages are display-only | — |
| 10 | No tests, no lint, no CI | — |
| 11 | Repo root has no `.gitignore` | / |
| 12 | `next.config.js` hard-codes a LAN dev origin (`192.168.88.36`) | frontend/next.config.js |
| 13 | **Hydration mismatch (React #418)** on ~10 pages (Alerts, Alert Rules, Alert Correlation, Logs, Events, Scheduled Tasks, Backup Job detail, Audit Logs, Live Ops). Seed data is built from `Date.now()` at module load, so build-time HTML ≠ browser render. Existed before the upgrade (confirmed on Next 15 build). | `src/mocks/*.ts` |
| 14 | Recharts 3 / Processes & Services page logs many "ResizeObserver loop" warnings (harmless, noisy) | components/monitoring/processes-services-dashboard.tsx |

## Fixed since the 2026-11-13 audit

- Typecheck errors in the Backup models are resolved – `tsc --noEmit` is clean.

## Dependency upgrade – 2026-11-27

| Package | Before | After |
|---|---|---|
| next | 15.5 | **16.4.6** |
| react / react-dom | 19.0 | 19.3.1 |
| typescript | 5.9 | **7.0.2** (build type-check 34 s → 3 s) |
| recharts | 2.15 | **3.11** |
| lucide-react | 0.468 | **1.82** |
| tailwind-merge | 2.6 | **3.7** |
| @types/* , postcss, simple-icons | — | latest patch |

Added `"engines": { "node": ">=20.9.0" }`. Code changes needed: 2 (Recharts Pie hover shape, Tooltip formatter type).
Verified: typecheck ✓, production build ✓ (47 static pages), all 64 routes return 200, every Recharts/ECharts chart renders in a browser.
Left on purpose: `@types/node` stays on 22 to match the installed Node 22.
