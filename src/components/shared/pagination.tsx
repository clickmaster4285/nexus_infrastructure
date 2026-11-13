"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  /** Noun used in the footer line, e.g. "tasks" → "of 28 tasks". Defaults to "items". */
  noun?: string;
  pageSizeOptions?: readonly number[];
  className?: string;
}

const DEFAULT_PAGE_SIZES = [10, 25, 50] as const;

function pageNumbers(totalPages: number, currentPage: number): Array<number | "..."> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const out: Array<number | "..."> = [1];
  const windowStart = Math.max(2, currentPage - 1);
  const windowEnd = Math.min(totalPages - 1, currentPage + 1);
  if (windowStart > 2) out.push("...");
  for (let page = windowStart; page <= windowEnd; page += 1) out.push(page);
  if (windowEnd < totalPages - 1) out.push("...");
  out.push(totalPages);
  return out;
}

/** Maintenance Windows-style pagination footer: count line, rows-per-page, numbered buttons. */
export function Pagination({ page, pageSize, totalItems, onPageChange, onPageSizeChange, noun = "items", pageSizeOptions = DEFAULT_PAGE_SIZES, className }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const startLabel = totalItems === 0 ? 0 : (clampedPage - 1) * pageSize + 1;
  const endLabel = Math.min(clampedPage * pageSize, totalItems);

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-[13px] text-muted-foreground", className)}>
      <p className="tabular-nums">Showing <b className="text-foreground">{startLabel}-{endLabel}</b> of <b className="text-foreground">{totalItems}</b> {noun}</p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5">
          <span className="sr-only">Rows per page</span>
          <Select value={String(pageSize)} onValueChange={(value) => { onPageSizeChange(Number(value)); onPageChange(1); }}>
            <SelectTrigger className="h-8 w-[64px] text-[13px]" aria-label="Rows per page"><SelectValue /></SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="hidden sm:inline">rows</span>
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, clampedPage - 1))}
            disabled={clampedPage <= 1}
            aria-label="Previous page"
            className="grid h-8 w-8 place-items-center rounded-lg border border-border text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={15} aria-hidden="true" />
          </button>
          {pageNumbers(totalPages, clampedPage).map((item, index) =>
            item === "..." ? (
              <span key={`ellipsis-${index}`} className="grid h-8 w-8 place-items-center text-muted-foreground">&hellip;</span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                aria-current={item === clampedPage ? "page" : undefined}
                aria-label={`Page ${item}`}
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-lg border text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  item === clampedPage ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-accent",
                )}
              >
                {item}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, clampedPage + 1))}
            disabled={clampedPage >= totalPages}
            aria-label="Next page"
            className="grid h-8 w-8 place-items-center rounded-lg border border-border text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
