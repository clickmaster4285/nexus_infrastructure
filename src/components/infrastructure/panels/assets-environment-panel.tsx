import { Panel } from "@/components/shared/panel";
import { assetsByEnvironment } from "@/data/mock/infrastructure";

const envColors = ["oklch(0.6389 0.1707 254.67)", "oklch(0.5774 0.2004 298.77)", "oklch(0.7299 0.1441 161.21)", "oklch(0.7761 0.1473 69.24)"];
const envNames = ["Production", "Staging", "Development", "Testing"];

export function AssetsEnvironmentPanel({ className }: { className?: string }) {
  return (
    <Panel title="Assets by Environment" className={className}>
      <div className="mb-4 mt-3 flex flex-wrap items-center gap-2.5">
        {envNames.map((name, index) => (
          <span key={name} className="flex items-center gap-1.5 whitespace-nowrap text-[0.75rem] text-[oklch(0.5784_0.0446_251.99)] dark:text-[oklch(0.7879_0.0377_252.13)]">
            <span aria-hidden="true" className="h-[0.4375rem] w-[0.4375rem] rounded-full" style={{ background: envColors[index] }} />
            {name}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {assetsByEnvironment.map((asset) => (
          <div key={asset.name} className="grid grid-cols-[88px_minmax(0,1fr)_1.5rem] items-center gap-2 text-[0.75rem] text-[oklch(0.542_0.046_254.21)] dark:text-[oklch(0.7879_0.0377_252.13)]">
            <span className="truncate">{asset.name}</span>
            <div className="flex h-[0.6875rem] overflow-hidden rounded-sm bg-muted" aria-hidden="true">
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
