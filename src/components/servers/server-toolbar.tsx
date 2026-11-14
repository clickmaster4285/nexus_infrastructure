import { Download, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { serverFilterOptions } from "@/data/mock/servers";

export interface ServerFilters {
  status: string;
  os: string;
  environment: string;
  provider: string;
  group: string;
  agent: string;
}

export const ALL_FILTER = "All";

export const defaultServerFilters: ServerFilters = {
  status: ALL_FILTER,
  os: ALL_FILTER,
  environment: ALL_FILTER,
  provider: ALL_FILTER,
  group: ALL_FILTER,
  agent: ALL_FILTER,
};

const filterDefinitions: Array<{ key: keyof ServerFilters; label: string; shortLabel: string; options: string[] }> = [
  { key: "status", label: "status", shortLabel: "Status", options: serverFilterOptions.status },
  { key: "os", label: "operating system", shortLabel: "OS", options: serverFilterOptions.operatingSystems },
  { key: "environment", label: "environment", shortLabel: "Environment", options: serverFilterOptions.environments },
  { key: "provider", label: "provider", shortLabel: "Provider", options: serverFilterOptions.providers },
  { key: "group", label: "server group", shortLabel: "Server Group", options: serverFilterOptions.groups },
  { key: "agent", label: "agent", shortLabel: "Agent", options: serverFilterOptions.agents },
];

interface ServerToolbarProps {
  search: string;
  filters: ServerFilters;
  onSearchChange: (value: string) => void;
  onFilterChange: (key: keyof ServerFilters, value: string) => void;
  onAddServer: () => void;
  onExport: () => void;
}

export function ServerToolbar({ search, filters, onSearchChange, onFilterChange, onAddServer, onExport }: ServerToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 border-b border-border p-3">
      {/* Search */}
      <label className="flex h-[2.375rem] min-w-[13.75rem] flex-1 cursor-text items-center gap-2.5 rounded-md border border-input bg-card px-3 text-muted-foreground transition-colors focus-within:ring-2 focus-within:ring-ring">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search servers, hostnames or IP addresses..."
          aria-label="Search servers"
          className="w-full min-w-0 bg-transparent text-[0.8125rem] text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>

      {/* Filters */}
      {filterDefinitions.map(({ key, label, shortLabel, options }) => (
        <Select key={key} value={filters[key]} onValueChange={(value) => onFilterChange(key, value)}>
          <SelectTrigger className="h-[2.375rem] w-[7rem] text-[0.75rem]" aria-label={`Filter by ${label}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option === ALL_FILTER ? `${shortLabel}: All` : option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {/* Actions */}
      <div className="ml-auto flex gap-2">
        <Button size="sm" className="h-[2.375rem] text-[0.75rem]" onClick={onAddServer}>
          <Plus size={13} aria-hidden="true" />
          Add Server
        </Button>
        <Button size="sm" variant="outline" className="h-[2.375rem] text-[0.75rem] text-[oklch(0.5066_0.0474_253.09)]" onClick={onExport}>
          <Download size={13} aria-hidden="true" />
          Export
        </Button>
      </div>
    </div>
  );
}
