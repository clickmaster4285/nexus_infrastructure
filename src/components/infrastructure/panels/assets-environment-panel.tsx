import { Panel } from "@/components/shared/panel";
import { assetsByEnvironment } from "@/data/mock/infrastructure";

const envColors = ["#368cf0", "#8c54dd", "#39c38a", "#f2a33b"];
const envNames = ["Production", "Staging", "Development", "Testing"];

export function AssetsEnvironmentPanel({ className }: { className?: string }) {
  return (
    <Panel title="Assets by Environment" className={className}>
      <div className="mb-4 mt-3 flex flex-wrap items-center gap-2.5">
        {envNames.map((name, index) => (
          <span key={name} className="flex items-center gap-1.5 whitespace-nowrap text-[12px] text-[#677c94] dark:text-[#a9bcd2]">
            <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full" style={{ background: envColors[index] }} />
            {name}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {assetsByEnvironment.map((asset) => (
          <div key={asset.name} className="grid grid-cols-[88px_minmax(0,1fr)_24px] items-center gap-2 text-[12px] text-[#5d718a] dark:text-[#a9bcd2]">
            <span className="truncate">{asset.name}</span>
            <div className="flex h-[11px] overflow-hidden rounded-sm bg-muted" aria-hidden="true">
              {asset.segments.map((value, index) =>
                value > 0 ? <span key={index} style={{ width: `${value}%`, background: envColors[index] }} /> : null,
              )}
            </div>
            <b className="text-right font-medium">{asset.total}</b>
          </div>
        ))}
      </div>
    </Panel>
  );
}
