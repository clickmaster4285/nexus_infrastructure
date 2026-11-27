"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Layers3, ListChecks, Search } from "lucide-react";

import { servers } from "@/mocks/servers";
import { serverGroups } from "@/mocks/server-groups";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { applyTemplateToTargets, type MonitoringTemplate, type TemplateAssignment } from "@/mocks/monitoringTemplates";

type TargetKind = TemplateAssignment["targetKind"];

const TARGET_KIND_LABEL: Record<TargetKind, string> = {
  Asset: "Asset",
  Group: "Group",
  Tag: "Tag",
  OS: "OS",
};

const TAG_OPTIONS = [...new Set(servers.flatMap((server) => server.tags))].sort();
const OS_OPTIONS = [...new Set(servers.map((server) => server.os))].sort();

function optionsFor(kind: TargetKind): string[] {
  switch (kind) {
    case "Asset": return servers.map((server) => server.name);
    case "Group": return serverGroups.map((group) => group.name);
    case "Tag": return TAG_OPTIONS;
    case "OS": return OS_OPTIONS;
  }
}

export function ApplyTemplateDialog({ open, onOpenChange, template, onApplied }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The template being applied; dialog is inert while null. */
  template: MonitoringTemplate | null;
  /** Called with the number of assignments created. */
  onApplied?: (count: number) => void;
}) {
  const [kind, setKind] = useState<TargetKind>("Group");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setKind("Group");
    setQuery("");
    setSelected([]);
  }, [open, template?.id]);

  const options = useMemo(() => {
    const all = optionsFor(kind);
    const q = query.trim().toLowerCase();
    return q ? all.filter((option) => option.toLowerCase().includes(q)) : all;
  }, [kind, query]);

  const toggle = (option: string) => setSelected((current) => current.includes(option) ? current.filter((item) => item !== option) : [...current, option]);

  const toggleAll = () => setSelected((current) => {
    const visible = options.filter((option) => !current.includes(option));
    return current.length === options.length && options.length > 0 ? current.filter((item) => !options.includes(item)) : [...current, ...visible];
  });

  const submit = () => {
    if (!template || selected.length === 0) return;
    const count = applyTemplateToTargets(template.id, kind, selected);
    onApplied?.(count);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(30rem,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>Apply {template ? `"${template.name}"` : "template"}</DialogTitle>
          <DialogDescription>Choose targets to apply this template. Existing agents, checks and alert rules will be reconciled against the template.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5 text-[0.8125rem] font-medium text-muted-foreground">
              Target type
              <Select value={kind} onValueChange={(value) => { setKind(value as TargetKind); setSelected([]); setQuery(""); }}>
                <SelectTrigger aria-label="Target type" className="h-10 text-[0.875rem]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TARGET_KIND_LABEL) as TargetKind[]).map((value) => <SelectItem key={value} value={value}>{TARGET_KIND_LABEL[value]}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <div className="flex items-end justify-between gap-2 pb-0.5 text-[0.75rem] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Layers3 size={13} aria-hidden="true" />{options.length} available</span>
              <button type="button" onClick={toggleAll} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-medium text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ListChecks size={13} aria-hidden="true" />{options.length > 0 && selected.length === options.length ? "Clear all" : "Select all"}</button>
            </div>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${TARGET_KIND_LABEL[kind].toLowerCase()}s…`} aria-label="Search targets" autoComplete="off" className="h-9 pl-9 text-[0.875rem]" />
          </div>
          <ul className="max-h-56 divide-y divide-border/60 overflow-y-auto rounded-lg border border-border [scrollbar-width:thin]" role="group" aria-label="Targets">
            {options.length ? options.map((option) => {
              const checked = selected.includes(option);
              return (
                <li key={option}>
                  <label className={cn("flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[0.8125rem] transition-colors hover:bg-muted/60", checked && "bg-primary/5")}>
                    <input type="checkbox" checked={checked} onChange={() => toggle(option)} aria-label={`Select ${option}`} className="h-4 w-4 shrink-0 accent-[var(--primary)]" />
                    <span className="min-w-0 flex-1 truncate text-foreground" title={option}>{option}</span>
                    {checked && <Check size={14} className="shrink-0 text-primary" aria-hidden="true" />}
                  </label>
                </li>
              );
            }) : <li className="px-3 py-6 text-center text-[0.8125rem] text-muted-foreground">No targets match this search.</li>}
          </ul>
          <div className="flex items-center gap-2 text-[0.75rem] text-muted-foreground">
            <Badge variant="secondary" className="text-[0.6875rem]">{selected.length} selected</Badge>
            {template && <span className="truncate">Applying {template.name} ({template.version})</span>}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={selected.length === 0} onClick={submit}><Check size={15} aria-hidden="true" />{selected.length > 0 ? `Apply to ${selected.length}` : "Apply"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
