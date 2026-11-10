interface PageHeadingProps {
  title: string;
  description?: string;
  /** Optional icon shown in a green chip next to the title. */
  icon?: React.ReactNode;
  /** Optional actions rendered on the right side, e.g. filter controls. */
  children?: React.ReactNode;
  /** Controls the vertical alignment of heading actions. */
  actionsAlign?: "top" | "bottom" | "end";
  /** Larger heading scale used by server detail dashboards. */
  variant?: "default" | "detail";
}

export function PageHeading({ title, description, icon, children, actionsAlign = "bottom", variant = "default" }: PageHeadingProps) {
  return (
    <div className={`mb-2.5 mt-1 flex flex-wrap items-center justify-between gap-3 ${variant === "detail" ? "min-h-14" : "min-h-10"}`}>
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && (
          <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#e6f8ef] text-[#22c55e] dark:bg-[#123a2a] dark:text-[#4fd69a]">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h1 className={`font-display leading-tight tracking-tight text-foreground ${variant === "detail" ? "text-[24px] font-semibold" : "text-[20px] font-extrabold"}`}>
            {title}
          </h1>
          {description && <p className={`mt-0.5 text-muted-foreground ${variant === "detail" ? "text-[13px]" : "text-[10px]"}`}>{description}</p>}
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
