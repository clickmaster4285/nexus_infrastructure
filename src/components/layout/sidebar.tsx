"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, X } from "lucide-react";

import { NAV_GROUPS } from "@/config/navigation";
import { cn } from "@/lib/utils";

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

function isItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  // Nested routes (e.g. /incidents/new, /incidents/INC-1042) keep the parent item active.
  return href !== "/" && pathname.startsWith(`${href}/`);
}

function groupContaining(pathname: string): string | null {
  const group = NAV_GROUPS.find((entry) => entry.items.some((item) =>
    isItemActive(pathname, item.href),
  ));
  return group?.title ?? null;
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<string | null>(() => groupContaining(pathname) ?? NAV_GROUPS[0]?.title ?? null);

  // Keep the active section expanded as the user navigates.
  useEffect(() => {
    const activeGroup = groupContaining(pathname);
    if (activeGroup) setExpanded(activeGroup);
  }, [pathname]);

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-[232px] flex-col overflow-y-auto border-r border-sidebar-border bg-gradient-to-b from-[#10233e] to-[#0d1e35] text-sidebar-foreground transition-transform duration-200 ease-in-out [scrollbar-width:thin] [scrollbar-color:#31465e_transparent]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
        )}
        aria-label="Main navigation"
      >
        {/* Brand */}
        <div className="flex h-[54px] min-h-[54px] items-center gap-2 border-b border-sidebar-border px-4">
          <div
            aria-hidden="true"
            className="font-display -skew-x-6 select-none text-[33px] font-extrabold italic leading-[34px] text-[#1aa1ef] [text-shadow:0_0_12px_#168ce744]"
          >
            N
          </div>
          <div className="min-w-0">
            <div className="font-display text-[14px] font-bold tracking-[3px] text-[#f0f5fa]">NEXUS</div>
            <div className="mt-0.5 text-[8px] leading-none text-sidebar-muted">Infrastructure Monitor</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="ml-auto rounded-md p-1.5 text-sidebar-foreground transition-colors hover:bg-white/5 lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-1" aria-label="Primary">
          {NAV_GROUPS.map((group) => {
            const isExpanded = expanded === group.title;
            const submenuId = `sidebar-submenu-${group.title.toLowerCase().replace(/\s+/g, "-")}`;
            const GroupIcon = group.icon;
            return (
              <div key={group.title} className="border-b border-white/5 px-2 pb-1 pt-1.5 last:border-b-0">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={submenuId}
                  onClick={() => setExpanded((current) => (current === group.title ? null : group.title))}
                  className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] font-medium text-[#f0f5fa] transition-colors hover:bg-white/5"
                >
                  <GroupIcon size={15} className="shrink-0 text-[#c9d5e4]" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{group.title}</span>
                  <ChevronDown
                    size={13}
                    aria-hidden="true"
                    className={cn("shrink-0 text-[#96a7bd] transition-transform duration-200 motion-reduce:transition-none", !isExpanded && "-rotate-90")}
                  />
                </button>
                <div
                  id={submenuId}
                  aria-hidden={!isExpanded}
                  className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-in-out motion-reduce:transition-none",
                    isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                >
                  <div className="min-h-0 overflow-hidden" inert={!isExpanded}>
                    <ul className="flex flex-col gap-0.5 pt-0.5">
                      {group.items.map((item) => {
                        const isActive = isItemActive(pathname, item.href);
                        const ItemIcon = item.icon;
                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              aria-current={isActive ? "page" : undefined}
                              onClick={onClose}
                              className={cn(
                                "flex h-8 items-center gap-2 rounded-md px-2 pl-[26px] text-xs font-normal text-sidebar-foreground outline-none transition-colors hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/40",
                                isActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                              )}
                            >
                              <ItemIcon size={14} aria-hidden="true" className={cn("shrink-0", isActive ? "text-white" : "text-[#b8c7da]")} />
                              <span className="truncate">{item.label}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer status */}
        <div className="border-t border-sidebar-border p-3.5">
          <div className="flex items-center justify-center gap-2 text-[10px] text-sidebar-muted">
            <span>Powered by <span className="font-semibold text-[#d8e5f5]">Click Master</span></span>
            <span className="rounded bg-white/5 px-1.5 py-0.5 font-medium">V1.0</span>
          </div>
        </div>
      </aside>

      {/* Mobile scrim */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={onClose}
          className="fixed inset-0 z-20 cursor-default bg-[#09172a]/60 lg:hidden"
        />
      )}
    </>
  );
}
