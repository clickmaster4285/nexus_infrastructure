"use client";

import { useCallback, useEffect, useId, useRef, useState, cloneElement, type HTMLAttributes, type ReactElement, type Ref } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export interface AlertMenuItem {
  key: string;
  label: string;
  disabled?: boolean;
  danger?: boolean;
  /** Renders a divider instead of a menu item. */
  divider?: boolean;
  /** Selecting this item runs the action and closes the menu. */
  onSelect?: () => void;
  /** Nested menu (opens to the left, flips up near the bottom edge). */
  items?: AlertMenuItem[];
}

type TriggerElement = ReactElement<HTMLAttributes<HTMLElement> & { ref?: Ref<HTMLButtonElement> }>;

interface AlertMenuProps {
  /** Trigger element (usually a Button); click toggles the menu. */
  trigger: TriggerElement;
  items: AlertMenuItem[];
  /** Accessible name for the trigger + menu. */
  label: string;
  /** Right-align (end) or left-align (start) the menu to the trigger. */
  align?: "start" | "end";
  /** Fixed menu width in px. */
  width?: number;
  /** Right-align the submenu content (used when the menu hugs the viewport edge). */
  submenuAlign?: "left" | "right";
  className?: string;
}

interface Position {
  top: number;
  left: number;
  openUp: boolean;
}

const MENU_W_DEFAULT = 200;

/**
 * Portal dropdown menu used by the alerts table kebabs, the bulk bar and
 * the header Export control. Closes on outside click, Escape and scroll;
 * opens upward when there is no space below (same behavior as the SLA
 * table's kebab menu).
 */
export function AlertMenu({ trigger, items, label, align = "end", width = MENU_W_DEFAULT, submenuAlign = "right", className }: AlertMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [submenuKey, setSubmenuKey] = useState<string | null>(null);
  const [submenuUp, setSubmenuUp] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  const openMenu = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const h = items.length * 36 + 12;
      const openUp = window.innerHeight - rect.bottom < h + 8 && rect.top > h + 8;
      const left = align === "end" ? Math.max(8, rect.right - width) : rect.left;
      setPosition({ top: openUp ? Math.max(8, rect.top - h - 6) : Math.min(rect.bottom + 6, window.innerHeight - h - 8), left, openUp });
    }
    setOpen(true);
  }, [align, items.length, width]);

  const close = useCallback(() => {
    setOpen(false);
    setSubmenuKey(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
        buttonRef.current?.focus();
      }
    };
    const onScroll = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      close();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  const chooseSubmenuUp = (itemElement: HTMLElement, item: AlertMenuItem) => {
    const rect = itemElement.getBoundingClientRect();
    const h = item.items!.length * 34 + 12;
    setSubmenuUp(window.innerHeight - rect.bottom < h + 8 && rect.top > h + 8);
  };

  return (
    <>
      {cloneElement(trigger, {
        ref: buttonRef,
        onClick: (event: React.MouseEvent) => {
          event.stopPropagation();
          open ? close() : openMenu();
        },
        onKeyDown: (event: React.KeyboardEvent) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            open ? close() : openMenu();
          }
        },
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": open ? menuId : undefined,
        "aria-label": label,
        className: cn(trigger.props.className, className),
      })}
      {open && position && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={label}
            className="motion-menu-in fixed z-[1400] rounded-[0.625rem] border border-gray-200 bg-white p-1.5 shadow-[0_8px_24px_rgba(16,24,40,0.12)] outline-none dark:border-border dark:bg-popover"
            style={{ top: position.top, left: position.left, width, transformOrigin: position.openUp ? "bottom right" : "top right" }}
          >
            {items.map((item) => {
              if (item.divider) return <div key={item.key} role="separator" className="mx-2 my-1 border-t border-border/70" />;
              const hasSubmenu = Boolean(item.items?.length);
              const submenuOpen = submenuKey === item.key;
              return (
                <div key={item.key} className="relative">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (item.disabled) return;
                      if (hasSubmenu) {
                        setSubmenuKey((current) => (current === item.key ? null : item.key));
                        if (!submenuOpen) chooseSubmenuUp(event.currentTarget, item);
                      } else {
                        item.onSelect?.();
                        close();
                      }
                    }}
                    aria-haspopup={hasSubmenu ? "menu" : undefined}
                    aria-expanded={hasSubmenu ? submenuOpen : undefined}
                    className={cn(
                      "flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-[0.8125rem] text-foreground transition-colors focus-visible:outline-none",
                      "hover:bg-gray-100 focus-visible:bg-gray-100 dark:hover:bg-accent dark:focus-visible:bg-accent",
                      item.disabled && "cursor-not-allowed opacity-40",
                      item.danger && "text-red-600 dark:text-red-400",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {hasSubmenu && <ChevronLeft size={13} aria-hidden="true" className="shrink-0 text-muted-foreground rtl:rotate-180" />}
                  </button>
                  {hasSubmenu && submenuOpen && (
                    <div
                      role="menu"
                      aria-label={item.label}
                      className={cn(
                        "motion-menu-in absolute z-[1410] w-[9.375rem] rounded-[0.625rem] border border-gray-200 bg-white p-1.5 shadow-[0_8px_24px_rgba(16,24,40,0.12)] outline-none dark:border-border dark:bg-popover",
                        submenuAlign === "right" ? "right-full mr-1" : "left-full ml-1",
                        submenuUp ? "bottom-0" : "top-0",
                      )}
                    >
                      {item.items!.map((sub) => (
                        <button
                          key={sub.key}
                          type="button"
                          role="menuitem"
                          disabled={sub.disabled}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (sub.disabled) return;
                            sub.onSelect?.();
                            close();
                          }}
                          className={cn(
                            "flex h-8 w-full items-center gap-1.5 rounded-md px-2.5 text-left text-[0.75rem] text-foreground transition-colors focus-visible:outline-none",
                            "hover:bg-gray-100 focus-visible:bg-gray-100 dark:hover:bg-accent dark:focus-visible:bg-accent",
                            sub.disabled && "cursor-not-allowed opacity-40",
                          )}
                        >
                          <span className="min-w-0 flex-1 truncate">{sub.label}</span>
                          <ChevronRight size={12} aria-hidden="true" className="shrink-0 text-muted-foreground rtl:rotate-180" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
