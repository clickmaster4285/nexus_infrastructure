import { faAws } from "@fortawesome/free-brands-svg-icons";
import { siDigitalocean, siHetzner } from "simple-icons";

import { cn } from "@/lib/utils";

interface ProviderLogoProps {
  provider: string;
  className?: string;
}

/** Brand mark for a cloud/on-prem provider. Falls back to the on-prem building icon. */
export function ProviderLogo({ provider, className }: ProviderLogoProps) {
  const type = provider.toLowerCase().replaceAll(" ", "-");

  if (type === "aws") {
    const pathData = faAws.icon[4];
    const d = Array.isArray(pathData) ? pathData.join(" ") : pathData;
    return (
      <svg
        className={cn("h-[1.0625rem] w-[1.0625rem] shrink-0 text-[oklch(0.7527_0.1546_68.93)]", className)}
        viewBox={`0 0 ${faAws.icon[0]} ${faAws.icon[1]}`}
        aria-hidden="true"
      >
        <path d={d} fill="currentColor" />
      </svg>
    );
  }
  if (type === "hetzner") {
    return (
      <svg className={cn("h-[1.0625rem] w-[1.0625rem] shrink-0 text-[oklch(0.5538_0.2194_23.17)]", className)} viewBox="0 0 24 24" aria-hidden="true">
        <path d={siHetzner.path} fill="currentColor" />
      </svg>
    );
  }
  if (type === "digitalocean") {
    return (
      <svg className={cn("h-[1.0625rem] w-[1.0625rem] shrink-0 text-[oklch(0.6152_0.2108_256.1)]", className)} viewBox="0 0 24 24" aria-hidden="true">
        <path d={siDigitalocean.path} fill="currentColor" />
      </svg>
    );
  }
  return <OnPremIcon className={cn("h-[1.0625rem] w-[1.0625rem] shrink-0 text-[oklch(0.5131_0.0511_252.79)]", className)} />;
}

export function OnPremIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M2 7.5 10 2l8 5.5v1H2zM3.5 9.5h13v8h-13zM2 18.5h16v1H2z" fill="currentColor" />
      <path d="M5.3 11h1.5v2H5.3zm4 0h1.5v2H9.3zm4 0h1.5v2h-1.5zm-8 3.5h1.5v2H5.3zm4 0h1.5v2H9.3zm4 0h1.5v2h-1.5z" fill="oklch(1 0 89.88)" />
    </svg>
  );
}

/** Maps a location string to a flag for the countries present in the mock data. */
export function LocationFlag({ location }: { location: string }) {
  const country = location.split(",").at(-1)?.trim();
  const flagClass = "h-3 w-[1.0625rem] shrink-0 rounded-[0.0625rem] shadow-[0_0_0_1px_oklch(0.2595_0.0482_258.68_/_0.071)]";

  if (country === "Germany") {
    return (
      <svg className={flagClass} viewBox="0 0 18 12" role="img" aria-label="Germany">
        <path fill="oklch(0 0 0)" d="M0 0h18v4H0z" /><path fill="oklch(0.5636 0.2313 29.23)" d="M0 4h18v4H0z" /><path fill="oklch(0.8691 0.1777 91.31)" d="M0 8h18v4H0z" />
      </svg>
    );
  }
  if (country === "Finland") {
    return (
      <svg className={flagClass} viewBox="0 0 18 12" role="img" aria-label="Finland">
        <path fill="oklch(1 0 89.88)" d="M0 0h18v12H0z" /><path fill="oklch(0.3506 0.1369 259.15)" d="M5 0h2v12H5zM0 5h18v2H0z" />
      </svg>
    );
  }
  if (country === "UK" || country === "United Kingdom") {
    return (
      <svg className={flagClass} viewBox="0 0 18 12" role="img" aria-label="United Kingdom">
        <path fill="oklch(0.2845 0.1308 262.28)" d="M0 0h18v12H0z" />
        <path d="m0 0 18 12M18 0 0 12" stroke="oklch(1 0 89.88)" strokeWidth="3.2" />
        <path d="m0 0 18 12M18 0 0 12" stroke="oklch(0.5304 0.2074 22.32)" strokeWidth="1.3" />
        <path stroke="oklch(1 0 89.88)" strokeWidth="4" d="M9 0v12M0 6h18" />
        <path stroke="oklch(0.5304 0.2074 22.32)" strokeWidth="2" d="M9 0v12M0 6h18" />
      </svg>
    );
  }
  if (country === "Pakistan") {
    return (
      <svg className={flagClass} viewBox="0 0 18 12" role="img" aria-label="Pakistan">
        <path fill="oklch(0.3287 0.0873 151.17)" d="M0 0h18v12H0z" /><path fill="oklch(1 0 89.88)" d="M0 0h4v12H0z" />
        <circle cx="11.6" cy="6" r="3.7" fill="oklch(1 0 89.88)" /><circle cx="12.8" cy="5" r="3.2" fill="oklch(0.3287 0.0873 151.17)" />
        <path fill="oklch(1 0 89.88)" d="m14.7 2.2.5 1.1 1.2.1-.9.8.3 1.2-1.1-.6-1 .6.2-1.2-.9-.8 1.2-.1z" />
      </svg>
    );
  }
  return null;
}
