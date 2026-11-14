import { cn } from "@/lib/utils";

interface PageHeadingProps {
  title: string;
  description?: string;
  /** Optional icon shown in a green chip next to the title. */
  icon?: React.ReactNode;
  /** Optional classes for the icon chip, e.g. "h-11 w-11 rounded-xl". */
  iconClassName?: string;
  /** Optional status pill rendered next to the title, before the actions. */
  statusBadge?: React.ReactNode;
  /** Optional actions rendered on the right side, e.g. filter controls. */
  children?: React.ReactNode;
  /** Controls the vertical alignment of heading actions. */
  actionsAlign?: "top" | "bottom" | "end";
  /** Extra classes merged onto the root row, e.g. tighter spacing. */
  className?: string;
}

export function PageHeading({ title, description, icon, iconClassName, statusBadge, children, actionsAlign = "bottom", className }: PageHeadingProps) {
  return (
    <div className={cn("mb-2.5 flex min-h-18 flex-wrap items-center justify-between gap-3", className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && (
          <span aria-hidden="true" className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[oklch(0.9634_0.0223_164.52)] text-green-500 dark:bg-[oklch(0.3149_0.0537_163.8)] dark:text-[oklch(0.7869_0.1465_160.69)]", iconClassName)}>
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <h1 className="font-display text-[2rem] font-bold leading-[1.2] tracking-tight text-foreground">
              {title}
            </h1>
            {statusBadge}
          </div>
          {description && <p className="mt-1 text-[0.875rem] text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children && (
        <div className={`flex min-w-0 flex-wrap items-center gap-2 ${actionsAlign === "top" ? "self-start" : actionsAlign === "end" ? "self-end" : "self-center"}`}>
          {children}
        </div>
      )}
    </div>
  );
}
