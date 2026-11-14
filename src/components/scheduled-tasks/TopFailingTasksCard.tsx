"use client";

import { AlertTriangle, MoreVertical } from "lucide-react";
import { AlertMenu } from "@/components/alerts/alert-menu";
import { ChartCard } from "@/components/logs/primitives";
import type { ScheduledTask } from "@/mocks/scheduledTasks";
import type { TaskRun } from "@/mocks/taskRuns";

export function TopFailingTasksCard({ tasks, runs }: { tasks: ScheduledTask[]; runs: TaskRun[] }) {
  const rows = tasks.map((task) => { const taskRuns = runs.filter((run) => run.taskId === task.id); const failed = taskRuns.filter((run) => run.status === "failed").length; const done = taskRuns.filter((run) => run.status === "success" || run.status === "failed"); return { task, failed, rate: done.length ? Math.round(done.filter((run) => run.status === "success").length / done.length * 100) : 100 }; }).filter((row) => row.failed > 0).sort((a, b) => b.failed - a.failed).slice(0, 6);
  return <ChartCard title="Top Failing Tasks" className="flex h-full min-w-0 flex-col rounded-xl p-4" actions={<AlertMenu label="Top failing tasks options" trigger={<button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent" aria-label="Top failing tasks options"><MoreVertical size={16} /></button>} items={[{ key: "table", label: "View as table", onSelect: () => undefined }, { key: "fullscreen", label: "Fullscreen", onSelect: () => undefined }]} />}>
    <div className="flex flex-1 flex-col gap-2">{rows.map(({ task, failed, rate }) => <div key={task.id} className="flex items-center gap-2 rounded-lg px-1.5 py-2 hover:bg-muted/50"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-rose-50 text-rose-500 dark:bg-rose-500/15"><AlertTriangle size={14} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{task.name}</p><p className="text-xs text-muted-foreground">{task.type} · {failed} failure{failed === 1 ? "" : "s"}</p></div><div className="w-20"><div className="h-1.5 rounded-full bg-muted"><div className={`h-full rounded-full ${rate >= 90 ? "w-11/12" : rate >= 75 ? "w-3/4" : rate >= 50 ? "w-1/2" : "w-1/4"} bg-emerald-400`} /></div><p className="mt-1 text-right text-xs tabular-nums text-muted-foreground">{rate}%</p></div></div>)}{rows.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No failed tasks</p>}</div><button type="button" className="mt-auto border-t border-border pt-3 text-left text-sm font-semibold text-primary hover:underline">View all →</button>
  </ChartCard>;
}
