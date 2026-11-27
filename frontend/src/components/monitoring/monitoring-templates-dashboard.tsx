"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Download, FileJson, LayoutGrid, List, MoreVertical, RefreshCw, Search, ShieldAlert, SlidersHorizontal, TriangleAlert, Upload } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/shared/panel";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ApplyTemplateDialog } from "@/components/monitoring/apply-template-dialog";
import {
  createMonitoringTemplate, importMonitoringTemplate, loadMonitoringTemplates, readTemplateAssignments, templateStats,
  type MonitoringTemplate, type TemplateAssignment, type TemplateCategory, type TemplateStatus, type TargetType,
} from "@/mocks/monitoringTemplates";

const button = "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const statusTone: Record<TemplateStatus, string> = { Published: "success", Draft: "secondary", Deprecated: "warning" };
const relative = (iso: string) => { const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000); return days <= 0 ? "today" : `${days}d ago`; };

export function MonitoringTemplatesDashboard() {
  const router = useRouter(); const pathname = usePathname(); const params = useSearchParams();
  const [templates, setTemplates] = useState<MonitoringTemplate[]>([]); const [loadState, setLoadState] = useState<"loading" | "error" | "ready">("loading");
  const [status, setStatus] = useState(params.get("status") || "All"); const [category, setCategory] = useState(params.get("category") || "All"); const [query, setQuery] = useState(params.get("q") || "");   const [view, setView] = useState<"cards" | "table">("cards"); const [notice, setNotice] = useState("");
  const [assignments, setAssignments] = useState<TemplateAssignment[]>(() => readTemplateAssignments());
  const [applyTemplate, setApplyTemplate] = useState<MonitoringTemplate | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const reload = useCallback(() => { setLoadState("loading"); void loadMonitoringTemplates().then((items) => { setTemplates(items); setAssignments(readTemplateAssignments()); setLoadState("ready"); }).catch(() => setLoadState("error")); }, []);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { const next = new URLSearchParams(params.toString()); status === "All" ? next.delete("status") : next.set("status", status); category === "All" ? next.delete("category") : next.set("category", category); query ? next.set("q", query) : next.delete("q"); router.replace(`${pathname}?${next.toString()}`, { scroll: false }); }, [status, category, query, pathname, params, router]);
  const toast = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2500); };
  const visible = useMemo(() => templates.filter((template) => (status === "All" || template.status === status) && (category === "All" || template.category === category) && `${template.name} ${template.description} ${template.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase())), [templates, status, category, query]);
  const appliedCount = useCallback((id: string) => assignments.filter((assignment) => assignment.templateId === id).length, [assignments]);
  const driftedCount = useMemo(() => assignments.filter((assignment) => assignment.status === "Drifted").length, [assignments]);
  const categories = useMemo(() => [...new Set(templates.map((template) => template.category))], [templates]);
  const openTemplate = (id: string) => router.push(`/monitoring/templates/${id}`);
  const appliedTotal = assignments.length;

  const exportLibrary = () => {
    if (templates.length === 0) return;
    const blob = new Blob([JSON.stringify(templates, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "monitoring-templates.json";
    anchor.click();
    URL.revokeObjectURL(url);
    toast(`Exported ${templates.length} templates`);
  };

  const importLibrary = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    void file.text().then((text) => {
      try {
        const template = importMonitoringTemplate(JSON.parse(text));
        reload();
        toast(`Imported "${template.name}" as a draft`);
      } catch (error) {
        toast(`Import failed: ${error instanceof Error ? error.message : "invalid JSON"}`);
      }
    }).catch(() => toast("Import failed: could not read file"));
  };

  const handleApplied = (count: number, templateName: string) => {
    setAssignments(readTemplateAssignments());
    toast(`${templateName} applied to ${count} target${count === 1 ? "" : "s"}`);
  };
  return <div className="space-y-4 pb-4">
    <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={importLibrary} aria-hidden="true" tabIndex={-1} />
    <PageHeader breadcrumbs={["Monitoring", "Monitoring Templates"]} title="Monitoring Templates" subtitle="Reusable sets of checks, alert rules and collectors you can apply to servers, groups and devices." demo lastUpdated={new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })} onRefresh={reload} actions={<><button className={button} onClick={() => fileRef.current?.click()}><Upload size={15} />Import</button><button className={button} onClick={exportLibrary}> <Download size={15} />Export</button><button className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground" onClick={() => setNewOpen(true)}>New Template</button></>} />
    <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-200"><span className="flex items-center gap-2"><TriangleAlert size={16} />4 assets have no template · 7 hosts drifted · 1 collector stale</span><button className="font-semibold underline" onClick={() => setStatus("Published")}>View gaps</button></div>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"><StatCard label="Total Templates" value={String(templates.length)} icon={<FileJson size={19} />} iconTone="bg-blue-500/10 text-blue-600" onClick={() => setStatus("All")} /><StatCard label="Published" value={String(templates.filter((template) => template.status === "Published").length)} icon={<Check size={19} />} iconTone="bg-emerald-500/10 text-emerald-600" onClick={() => setStatus("Published")} /><StatCard label="Applied Targets" value={String(appliedTotal)} icon={<SlidersHorizontal size={19} />} iconTone="bg-violet-500/10 text-violet-600" /><StatCard label="Coverage" value={`${templateStats.coverage}%`} icon={<ShieldAlert size={19} />} iconTone="bg-sky-500/10 text-sky-600" /><StatCard label="Drifted" value={String(driftedCount)} goodDirection="down" icon={<TriangleAlert size={19} />} iconTone="bg-amber-500/10 text-amber-600" /><StatCard label="Unused" value={String(templateStats.unused)} goodDirection="down" icon={<Copy size={19} />} iconTone="bg-slate-500/10 text-slate-600" /></div>
    <Card className="rounded-xl p-4"><div className="flex flex-wrap items-center gap-2"><div className="relative min-w-[14rem] flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search templates, checks, tags…" className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div><Select value={status} onValueChange={setStatus}><SelectTrigger className="h-9 w-32 text-sm"><SelectValue /></SelectTrigger><SelectContent>{["All", "Published", "Draft", "Deprecated"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><Select value={category} onValueChange={setCategory}><SelectTrigger className="h-9 w-44 text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="All">All categories</SelectItem>{categories.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><button className={button} onClick={() => { setStatus("All"); setCategory("All"); setQuery(""); }}>Reset</button><div className="flex rounded-lg border border-border p-0.5"><button className={cn("grid h-8 w-9 place-items-center rounded-md", view === "cards" && "bg-muted")} onClick={() => setView("cards")} aria-label="Cards view"><LayoutGrid size={16} /></button><button className={cn("grid h-8 w-9 place-items-center rounded-md", view === "table" && "bg-muted")} onClick={() => setView("table")} aria-label="Table view"><List size={16} /></button></div></div>
      {loadState === "loading" ? <div className="grid min-h-64 place-items-center text-sm text-muted-foreground"><RefreshCw className="mr-2 animate-spin" size={17} />Loading templates…</div> : loadState === "error" ? <div className="grid min-h-64 place-items-center"><button className={button} onClick={reload}>Retry</button></div> : visible.length === 0 ? <div className="grid min-h-64 place-items-center text-sm text-muted-foreground">No templates match these filters.</div> : view === "cards" ? <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map((template) => <Card key={template.id} className="flex min-w-0 flex-col rounded-xl p-4"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileJson size={20} /></span><div className="min-w-0 flex-1"><button className="truncate text-left text-sm font-bold hover:text-primary" onClick={() => openTemplate(template.id)}>{template.name}</button><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{template.description}</p></div><MoreVertical size={17} className="text-muted-foreground" /></div><div className="mt-3 flex flex-wrap gap-1.5"><Badge variant={statusTone[template.status] as "success" | "warning" | "secondary"}>{template.status}</Badge><Badge variant="outline">{template.version}</Badge><Badge variant="outline">{template.builtIn ? "Built-in" : "Custom"}</Badge></div><div className="mt-4 grid grid-cols-3 gap-2 text-xs text-muted-foreground"><span><b className="block text-sm text-foreground">{template.items.length}</b>Checks</span><span><b className="block text-sm text-foreground">{template.alertRules.length}</b>Alerts</span><span><b className="block text-sm text-foreground">{appliedCount(template.id)}</b>Applied</span></div><div className="mt-3 flex flex-wrap gap-1.5">{template.collectorsRequired.map((collector) => <span key={collector} className="rounded-full bg-muted px-2 py-1 text-xs">{collector}</span>)}</div><div className="mt-auto flex items-center justify-between gap-2 pt-4"><span className="text-xs text-muted-foreground">Updated {relative(template.updatedAt)}</span><button className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground" onClick={() => setApplyTemplate(template)}>Apply</button></div></Card>)}</div> : <div className="mt-4 overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[850px] text-left text-[13px]"><thead className="bg-muted text-xs text-muted-foreground"><tr>{["Template", "Category", "Target", "Version", "Status", "Checks", "Applied", "Updated", "Owner"].map((head) => <th key={head} className="px-3 py-3 font-semibold">{head}</th>)}</tr></thead><tbody>{visible.map((template) => <tr key={template.id} onClick={() => openTemplate(template.id)} className="cursor-pointer border-t border-border hover:bg-muted/50"><td className="px-3 py-3"><b>{template.name}</b><span className="block text-xs text-muted-foreground">{template.description}</span></td><td className="px-3 py-3">{template.category}</td><td className="px-3 py-3">{template.targetType}</td><td className="px-3 py-3">{template.version}</td><td className="px-3 py-3"><Badge variant={statusTone[template.status] as "success" | "warning" | "secondary"}>{template.status}</Badge></td><td className="px-3 py-3">{template.items.length}</td><td className="px-3 py-3">{appliedCount(template.id)}</td><td className="px-3 py-3">{relative(template.updatedAt)}</td><td className="px-3 py-3">{template.owner}</td></tr>)}</tbody></table></div>}
    </Card>
    <div className="grid items-stretch gap-4 xl:grid-cols-3"><Panel title="Most Applied Templates"><div className="space-y-3">{[...templates].sort((a, b) => appliedCount(b.id) - appliedCount(a.id)).slice(0, 6).map((template) => <button key={template.id} onClick={() => openTemplate(template.id)} className="flex w-full items-center gap-2 text-left text-sm"><FileJson size={15} className="text-primary" /><span className="min-w-0 flex-1 truncate">{template.name}</span><b>{appliedCount(template.id)}</b></button>)}</div></Panel><Panel title="Drift & Gaps"><div className="space-y-3 text-sm"><div className="flex items-center gap-2"><TriangleAlert size={15} className="text-amber-600" /><span className="flex-1">Windows Exporter stale</span><Badge variant="warning">{driftedCount} drifted</Badge></div><div className="flex items-center gap-2"><ShieldAlert size={15} className="text-rose-600" /><span className="flex-1">Assets without template</span><Badge variant="destructive">4 gaps</Badge></div></div></Panel><Panel title="Templates by Category"><div className="grid grid-cols-2 gap-2 text-sm">{categories.slice(0, 6).map((item) => <button key={item} onClick={() => setCategory(item)} className="rounded-lg bg-muted/50 p-2 text-left hover:bg-muted"><span className="block truncate text-xs">{item}</span><b>{templates.filter((template) => template.category === item).length}</b></button>)}</div></Panel></div>
    <ApplyTemplateDialog open={applyTemplate !== null} onOpenChange={(open) => { if (!open) setApplyTemplate(null); }} template={applyTemplate} onApplied={(count) => applyTemplate && handleApplied(count, applyTemplate.name)} />
    <NewTemplateDialog open={newOpen} onOpenChange={setNewOpen} onCreated={(template) => { reload(); toast(`Template "${template.name}" created as a draft`); }} />
    {notice && <div role="status" className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-lg"><Check size={16} className="text-emerald-600" />{notice}</div>}
  </div>;
}
const NEW_TEMPLATE_CATEGORIES: readonly TemplateCategory[] = ["Server OS", "Database", "Network", "Web/API", "Container", "Application", "Cloud"];
const NEW_TEMPLATE_TARGET_TYPES: readonly TargetType[] = ["Server", "Network Device", "Database", "Website", "Container"];

function NewTemplateDialog({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the created template (list refreshes itself). */
  onCreated: (template: MonitoringTemplate) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TemplateCategory>("Application");
  const [targetType, setTargetType] = useState<TargetType>("Server");

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setCategory("Application");
    setTargetType("Server");
  }, [open]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;
    const template = createMonitoringTemplate({ name: cleanName, description: description.trim() || undefined, category, targetType });
    onCreated(template);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(30rem,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>New template</DialogTitle>
          <DialogDescription>Create a custom template. It starts as a Draft with sensible defaults; edit checks and rules after creation.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <label className="block space-y-1.5 text-[0.8125rem] font-medium text-muted-foreground">
            Template name
            <Input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Production Node.js Service" aria-label="Template name" autoComplete="off" className="h-10 text-[0.875rem]" />
          </label>
          <label className="block space-y-1.5 text-[0.8125rem] font-medium text-muted-foreground">
            Description
            <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What does this template cover?" aria-label="Description" autoComplete="off" className="h-10 text-[0.875rem]" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5 text-[0.8125rem] font-medium text-muted-foreground">
              Category
              <Select value={category} onValueChange={(value) => setCategory(value as TemplateCategory)}>
                <SelectTrigger aria-label="Category" className="h-10 text-[0.875rem]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NEW_TEMPLATE_CATEGORIES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <label className="block space-y-1.5 text-[0.8125rem] font-medium text-muted-foreground">
              Target type
              <Select value={targetType} onValueChange={(value) => setTargetType(value as TargetType)}>
                <SelectTrigger aria-label="Target type" className="h-10 text-[0.875rem]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NEW_TEMPLATE_TARGET_TYPES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
          </div>
          <DialogFooter className="pt-1">
            <button type="button" className={button} onClick={() => onOpenChange(false)}>Cancel</button>
            <button type="submit" className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Create Template</button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
