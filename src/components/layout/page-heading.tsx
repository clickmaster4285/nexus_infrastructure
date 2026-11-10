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
  /** Larger heading scale used by server detail dashboards. */
  variant?: "default" | "detail";
}

export function PageHeading({ title, description, icon, iconClassName, statusBadge, children, actionsAlign = "bottom" }: PageHeadingProps) {
  return (
    <div className="mb-2.5 mt-1 flex min-h-[72px] flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && (
          <span aria-hidden="true" className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#e6f8ef] text-[#22c55e] dark:bg-[#123a2a] dark:text-[#4fd69a]", iconClassName)}>
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <h1 className="font-display text-[32px] font-bold leading-[1.2] tracking-tight text-foreground">
              {title}
            </h1>
            {statusBadge}
          </div>
          {description && <p className="mt-1 text-[14px] text-muted-foreground">{description}</p>}
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
