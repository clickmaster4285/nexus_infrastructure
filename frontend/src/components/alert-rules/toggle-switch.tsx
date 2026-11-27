"use client";

import { cn } from "@/lib/utils";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name, e.g. 'Enable rule "High CPU usage"'. */
  label: string;
  disabled?: boolean;
  size?: "sm" | "md";
}

/** Flat switch used by the rules table toggle column and policy forms. */
export function ToggleSwitch({ checked, onChange, label, disabled = false, size = "md" }: ToggleSwitchProps) {
  const dims = size === "sm" ? "h-5 w-9" : "h-6 w-11";
  const knob = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";
  const travel = size === "sm" ? "translate-x-4" : "translate-x-5";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
      onKeyDown={(event) => event.stopPropagation()}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        dims,
        checked ? "bg-green-600" : "bg-slate-300 dark:bg-slate-600",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block transform rounded-full bg-white shadow transition-transform duration-150",
          knob,
          checked ? travel : "translate-x-0.5",
        )}
      />
    </button>
  );
}
