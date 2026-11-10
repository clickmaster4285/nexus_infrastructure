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
        className={cn("h-[17px] w-[17px] shrink-0 text-[#ed9a24]", className)}
        viewBox={`0 0 ${faAws.icon[0]} ${faAws.icon[1]}`}
        aria-hidden="true"
      >
        <path d={d} fill="currentColor" />
      </svg>
    );
  }
  if (type === "hetzner") {
    return (
      <svg className={cn("h-[17px] w-[17px] shrink-0 text-[#d50c2d]", className)} viewBox="0 0 24 24" aria-hidden="true">
        <path d={siHetzner.path} fill="currentColor" />
      </svg>
    );
  }
  if (type === "digitalocean") {
    return (
      <svg className={cn("h-[17px] w-[17px] shrink-0 text-[#0080ff]", className)} viewBox="0 0 24 24" aria-hidden="true">
        <path d={siDigitalocean.path} fill="currentColor" />
      </svg>
    );
  }
  return <OnPremIcon className={cn("h-[17px] w-[17px] shrink-0 text-[#526984]", className)} />;
}

export function OnPremIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M2 7.5 10 2l8 5.5v1H2zM3.5 9.5h13v8h-13zM2 18.5h16v1H2z" fill="currentColor" />
      <path d="M5.3 11h1.5v2H5.3zm4 0h1.5v2H9.3zm4 0h1.5v2h-1.5zm-8 3.5h1.5v2H5.3zm4 0h1.5v2H9.3zm4 0h1.5v2h-1.5z" fill="#fff" />
    </svg>
  );
}

/** Maps a location string to a flag for the countries present in the mock data. */
export function LocationFlag({ location }: { location: string }) {
  const country = location.split(",").at(-1)?.trim();
  const flagClass = "h-3 w-[17px] shrink-0 rounded-[1px] shadow-[0_0_0_1px_#15243b12]";

  if (country === "Germany") {
    return (
      <svg className={flagClass} viewBox="0 0 18 12" role="img" aria-label="Germany">
        <path fill="#000" d="M0 0h18v4H0z" /><path fill="#DD0000" d="M0 4h18v4H0z" /><path fill="#FFCE00" d="M0 8h18v4H0z" />
      </svg>
    );
  }
  if (country === "Finland") {
    return (
      <svg className={flagClass} viewBox="0 0 18 12" role="img" aria-label="Finland">
        <path fill="#fff" d="M0 0h18v12H0z" /><path fill="#003580" d="M5 0h2v12H5zM0 5h18v2H0z" />
      </svg>
    );
  }
  if (country === "UK" || country === "United Kingdom") {
    return (
      <svg className={flagClass} viewBox="0 0 18 12" role="img" aria-label="United Kingdom">
        <path fill="#012169" d="M0 0h18v12H0z" />
        <path d="m0 0 18 12M18 0 0 12" stroke="#fff" strokeWidth="3.2" />
        <path d="m0 0 18 12M18 0 0 12" stroke="#C8102E" strokeWidth="1.3" />
        <path stroke="#fff" strokeWidth="4" d="M9 0v12M0 6h18" />
        <path stroke="#C8102E" strokeWidth="2" d="M9 0v12M0 6h18" />
      </svg>
    );
  }
  if (country === "Pakistan") {
    return (
      <svg className={flagClass} viewBox="0 0 18 12" role="img" aria-label="Pakistan">
        <path fill="#01411C" d="M0 0h18v12H0z" /><path fill="#fff" d="M0 0h4v12H0z" />
        <circle cx="11.6" cy="6" r="3.7" fill="#fff" /><circle cx="12.8" cy="5" r="3.2" fill="#01411C" />
        <path fill="#fff" d="m14.7 2.2.5 1.1 1.2.1-.9.8.3 1.2-1.1-.6-1 .6.2-1.2-.9-.8 1.2-.1z" />
      </svg>
    );
  }
  return null;
}
