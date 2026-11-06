interface PageHeadingProps {
  title: string;
  description?: string;
  /** Optional icon shown in a green chip next to the title. */
  icon?: React.ReactNode;
  /** Optional actions rendered on the right side, e.g. filter controls. */
  children?: React.ReactNode;
}

export function PageHeading({ title, description, icon, children }: PageHeadingProps) {
  return (
    <div className="mb-2.5 mt-1 flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && (
          <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#e6f8ef] text-[#22c55e] dark:bg-[#123a2a] dark:text-[#4fd69a]">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-[20px] font-extrabold leading-tight tracking-tight text-foreground">
            {title}
          </h1>
          {description && <p className="mt-0.5 text-[10px] text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 pb-0.5">{children}</div>}
    </div>
  );
}
