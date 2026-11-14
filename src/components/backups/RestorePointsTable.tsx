import { useEffect, useMemo, useState } from "react";
import { Archive } from "lucide-react";

import { BackupTypeBadge, VerifiedBadge } from "@/components/backups/backup-badges";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/mocks/logs";
import type { RestorePoint } from "@/mocks/restorePoints";
import { formatBytes } from "@/utils/storageForecast";
import { formatDuration } from "@/utils/backupStats";
import { cn } from "@/lib/utils";

interface RestorePointsTableProps {
  points: RestorePoint[];
  onRestore: (pointId: string) => void;
  density: "default" | "compact";
}

const EXACT = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
const PAGE_SIZE = 10;

/** Sealed restore points derived from successful runs. Rows are not links; the Restore button opens the restore flow. */
export function RestorePointsTable({ points, onRestore, density }: RestorePointsTableProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const rowHeight = density === "compact" ? "h-12" : "h-14";

  useEffect(() => { setPage(1); }, [points.length, pageSize]);
  const pageCount = Math.max(1, Math.ceil(points.length / pageSize));
  const clampedPage = Math.min(page, pageCount);
  const start = (clampedPage - 1) * pageSize;
  const pageItems = useMemo(() => points.slice(start, start + pageSize), [points, start, pageSize]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="hidden lg:block">
        <table className="w-full table-fixed border-collapse text-left">
          <colgroup>
            <col style={{ width: "20%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "11%" }} />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-card">
              {["Point", "Asset", "Type", "Size", "Created", "Verified"].map((label) => (
                <th key={label} scope="col" className="px-3 py-2 text-[0.75rem] font-semibold uppercase tracking-wide text-muted-foreground">{label}</th>
              ))}
              <th scope="col" className="px-3 py-2 text-right text-[0.75rem] font-semibold uppercase tracking-wide text-muted-foreground"><span className="sr-only">Restore</span></th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((point) => (
              <tr key={point.id} className={cn("border-b border-border/60 align-middle transition-colors hover:bg-slate-50 dark:hover:bg-muted/40", rowHeight)}>
                <td className="min-w-0 px-3 py-1.5 align-middle">
                  <span className="block font-mono text-[0.75rem] text-muted-foreground">{point.id}</span>
                  <span className="mt-0.5 block truncate text-[0.8125rem] font-semibold text-foreground" title={point.jobName}>{point.jobName}</span>
                </td>
                <td className="min-w-0 px-3 py-1.5 align-middle">
                  <span className="block font-mono text-[0.75rem] text-foreground">{point.host}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">{point.assetType}</span>
                </td>
                <td className="px-3 py-1.5 align-middle"><BackupTypeBadge type={point.type} /></td>
                <td className="px-3 py-1.5 align-middle text-[0.75rem] tabular-nums text-foreground">{formatBytes(point.sizeBytes)}</td>
                <td className="min-w-0 px-3 py-1.5 align-middle">
                  <span className="block text-[0.75rem] tabular-nums text-foreground">{timeAgo(point.epochMs)}</span>
                  <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">{EXACT.format(point.epochMs)}</span>
                </td>
                <td className="px-3 py-1.5 align-middle"><VerifiedBadge verified={point.verified} /></td>
                <td className="px-3 py-1.5 text-right align-middle">
                  <Button variant="outline"  onClick={() => onRestore(point.id)}>
                    <Archive size={12} aria-hidden="true" />Restore
                  </Button>
                </td>
              </tr>
            ))}
            {pageItems.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center"><p className="text-sm font-semibold text-foreground">No restore points match your filters</p><p className="mt-1 text-[0.75rem] text-muted-foreground">Points are created only by successful runs.</p></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <div className="divide-y divide-border/60 lg:hidden">
        {pageItems.map((point) => (
          <div key={point.id} className="flex items-start justify-between gap-2 p-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{point.id}</span>
                <VerifiedBadge verified={point.verified} />
              </div>
              <p className="mt-0.5 truncate text-[0.8125rem] font-semibold text-foreground">{point.jobName}</p>
              <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{point.host} &middot; {timeAgo(point.epochMs)} &middot; {formatBytes(point.sizeBytes)}{point.durationMs ? ` &middot; ${formatDuration(point.durationMs)}` : ""}</p>
            </div>
            <Button variant="outline" className="shrink-0" onClick={() => onRestore(point.id)}>Restore</Button>
          </div>
        ))}
        {pageItems.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">No restore points match your filters.</p>}
      </div>

      <Pagination page={clampedPage} pageSize={pageSize} totalItems={points.length} onPageChange={setPage} onPageSizeChange={setPageSize} noun="restore points" />
    </div>
  );
}
