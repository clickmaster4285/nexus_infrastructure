import * as FlagComponents from "country-flag-icons/react/3x2";

import { cn } from "@/lib/utils";

interface CountryFlagProps {
  /** ISO 3166-1 alpha-2 code, e.g. "PK", "DE". Unknown codes render a labelled placeholder. */
  code: string;
  /** Accessible country name used for title/aria-label. */
  name: string;
  className?: string;
}

/** Shared flag chip mapped from an ISO alpha-2 code; used by auth events, sites and locations. */
export function CountryFlag({ code, name, className }: CountryFlagProps) {
  const normalized = code.toUpperCase();
  const Flag = (FlagComponents as unknown as Record<string, typeof FlagComponents.DE | undefined>)[normalized];

  if (!Flag) {
    return (
      <span
        role="img"
        aria-label={`${name} flag unavailable`}
        className={cn("grid h-[1.125rem] w-6 shrink-0 place-items-center rounded-[0.1875rem] bg-muted text-[0.5625rem] font-semibold text-muted-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.08)]", className)}
      >
        {normalized.slice(0, 2)}
      </span>
    );
  }

  return (
    <Flag
      title={`${name} flag`}
      aria-label={`${name} flag`}
      className={cn("h-[1.125rem] w-6 shrink-0 rounded-[0.1875rem] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]", className)}
    />
  );
}
