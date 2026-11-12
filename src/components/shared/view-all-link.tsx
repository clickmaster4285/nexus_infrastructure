import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/** Shared "View all →" footer link used by insight cards. */
export function ViewAllLink({ label = "View all", href, onClick, className }: { label?: string; href?: string; onClick?: () => void; className?: string }) {
  const classes = cn(
    "inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[13px] font-semibold text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    className,
  );
  const content = (
    <>
      {label}
      <ArrowRight size={13} aria-hidden="true" />
    </>
  );
  if (href) {
    return <Link href={href} className={classes}>{content}</Link>;
  }
  return (
    <button type="button" onClick={onClick} className={classes}>
      {content}
    </button>
  );
}
