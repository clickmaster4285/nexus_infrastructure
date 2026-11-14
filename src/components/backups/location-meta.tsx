import { Archive, Cloud, HardDrive } from "lucide-react";

import { cn } from "@/lib/utils";

const POOL_ICON = { "pool-nas": HardDrive, "pool-s3": Cloud, "pool-vault": Archive } as const;

export const POOL_LABELS: Record<string, string> = {
  "pool-nas": "Local NAS",
  "pool-s3": "AWS S3",
  "pool-vault": "Offsite Vault",
};

/** Pool icon + readable name, used by the jobs table and the policy drawer. */
export function LocationCell({ poolId, className }: { poolId: string; className?: string }) {
  const Icon = POOL_ICON[poolId as keyof typeof POOL_ICON] ?? HardDrive;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-[0.8125rem] text-foreground", className)}>
      <Icon size={15} aria-hidden="true" className="shrink-0 text-muted-foreground" />
      <span className="truncate">{POOL_LABELS[poolId] ?? poolId}</span>
    </span>
  );
}
