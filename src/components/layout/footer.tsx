export function Footer() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-1 pt-3 text-[8px] text-muted-foreground">
      <span>© 2026 Nexus Infrastructure Monitor</span>
      <span className="flex items-center gap-1.5">
        All systems operational
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-success" />
      </span>
    </footer>
  );
}
