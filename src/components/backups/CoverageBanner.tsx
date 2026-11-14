import { CheckCheck, ShieldAlert, ChevronRight } from "lucide-react";

interface CoverageBannerProps {
  /** Assets with no backup configured. */
  unprotectedCount: number;
  /** Assessable jobs whose last successful backup is outside their RPO target. */
  rpoBreachCount: number;
  onView: () => void;
}

/**
 * One-line coverage strip under the page header (Maintenance Windows banner style).
 * Flags unprotected assets and RPO breaches; renders a green all-clear otherwise.
 * Presentational only - the parent owns the "View" action.
 */
export function CoverageBanner({ unprotectedCount, rpoBreachCount, onView }: CoverageBannerProps) {
  const issues = unprotectedCount + rpoBreachCount;

  if (issues === 0) {
    return (
      <div role="status" className="flex min-h-[40px] flex-wrap items-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200">
        <CheckCheck size={14} aria-hidden="true" className="shrink-0" />
        <span className="font-medium">All assets protected</span>
        <span aria-hidden="true" className="text-emerald-300 dark:text-emerald-600">&middot;</span>
        <span>every protected asset is within its RPO target</span>
      </div>
    );
  }

  return (
    <div role="status" className="flex min-h-[40px] flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-2 dark:border-amber-500/25 dark:bg-amber-500/10">
      <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-sm text-amber-900 dark:text-amber-200">
        <ShieldAlert size={14} aria-hidden="true" className="shrink-0" />
        <span className="font-semibold">{unprotectedCount} asset{unprotectedCount === 1 ? "" : "s"} with no backup</span>
        {rpoBreachCount > 0 && (
          <>
            <span aria-hidden="true" className="text-amber-300 dark:text-amber-600">&middot;</span>
            <span className="font-semibold">{rpoBreachCount} asset{rpoBreachCount === 1 ? "" : "s"} breaching RPO</span>
          </>
        )}
      </p>
      <button
        type="button"
        onClick={onView}
        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-amber-200 bg-white px-3 text-[13px] font-semibold text-amber-800 shadow-sm transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200"
      >
        View<ChevronRight size={13} aria-hidden="true" />
      </button>
    </div>
  );
}
