import { ArrowRight } from "lucide-react";

import { Panel } from "@/components/shared/panel";
import { cn } from "@/lib/utils";
import { unmonitoredAssets } from "@/data/mock/infrastructure";

export function UnmonitoredAssetsPanel({ className }: { className?: string }) {
  const action = (
    <button type="button" className="flex cursor-pointer items-center gap-1 text-[0.75rem] text-[#4284c1] transition-colors hover:text-[#2f6ea8]">
      View All <ArrowRight size={12} aria-hidden="true" />
    </button>
  );

  return (
    <Panel title="Unmonitored Assets" action={action} className={className}>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[18.75rem] border-collapse">
          <thead>
            <tr>
              {["Asset", "Type", "Reason", "Action"].map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="border-b border-border px-1.5 py-2 text-left text-[0.75rem] font-semibold text-muted-foreground"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {unmonitoredAssets.map((asset) => (
              <tr key={asset.name} className="border-b border-border/60 last:border-b-0">
                <td className="px-1.5 py-2 text-[0.75rem] font-medium text-[#526881] dark:text-[#b7c4d5]">{asset.name}</td>
                <td className="whitespace-nowrap px-1.5 py-2 text-[0.75rem] text-[#526881] dark:text-[#b7c4d5]">{asset.type}</td>
                <td className="whitespace-nowrap px-1.5 py-2 text-[0.75rem] text-[#526881] dark:text-[#b7c4d5]">
                  <span
                    aria-hidden="true"
                    className={cn("mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#e74752] align-middle", asset.tone === "amber" && "bg-[#ef9f2e]")}
                  />
                  {asset.reason}
                </td>
                <td className="px-1.5 py-2">
                  <button
                    type="button"
                    className="cursor-pointer rounded border-0 bg-[#edf5fd] px-2 py-1 text-[0.75rem] font-semibold text-[#3683c9] transition-colors hover:bg-[#dcebfb] dark:bg-[#20344b] dark:text-[#9bc9f4]"
                  >
                    {asset.action}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
