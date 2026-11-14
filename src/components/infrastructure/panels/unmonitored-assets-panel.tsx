import { ArrowRight } from "lucide-react";

import { Panel } from "@/components/shared/panel";
import { cn } from "@/lib/utils";
import { unmonitoredAssets } from "@/data/mock/infrastructure";

export function UnmonitoredAssetsPanel({ className }: { className?: string }) {
  const action = (
    <button type="button" className="flex cursor-pointer items-center gap-1 text-[0.75rem] text-[oklch(0.5977_0.1154_248.69)] transition-colors hover:text-[oklch(0.5254_0.1121_249.21)]">
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
                <td className="px-1.5 py-2 text-[0.75rem] font-medium text-[oklch(0.5094_0.0479_251.97)] dark:text-[oklch(0.8156_0.0279_255.11)]">{asset.name}</td>
                <td className="whitespace-nowrap px-1.5 py-2 text-[0.75rem] text-[oklch(0.5094_0.0479_251.97)] dark:text-[oklch(0.8156_0.0279_255.11)]">{asset.type}</td>
                <td className="whitespace-nowrap px-1.5 py-2 text-[0.75rem] text-[oklch(0.5094_0.0479_251.97)] dark:text-[oklch(0.8156_0.0279_255.11)]">
                  <span
                    aria-hidden="true"
                    className={cn("mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[oklch(0.6287_0.1959_21.14)] align-middle", asset.tone === "amber" && "bg-[oklch(0.7646_0.1516_69.93)]")}
                  />
                  {asset.reason}
                </td>
                <td className="px-1.5 py-2">
                  <button
                    type="button"
                    className="cursor-pointer rounded border-0 bg-[oklch(0.9665_0.0137_247.97)] px-2 py-1 text-[0.75rem] font-semibold text-[oklch(0.5955_0.131_249.19)] transition-colors hover:bg-[oklch(0.9337_0.027_249.85)] dark:bg-[oklch(0.3194_0.0488_252.73)] dark:text-[oklch(0.8185_0.0779_247.08)]"
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
