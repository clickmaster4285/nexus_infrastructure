"use client";

import { useEffect, useState } from "react";

import { getTaskRunsSnapshot, subscribeTaskRuns, type TaskRun } from "@/mocks/taskRuns";

/**
 * Run history for one task, newest first. Subscribes to the runs store so a
 * `runNow` / `retryRun` action appears immediately without a refetch.
 */
export function useTaskRuns(taskId: string | null | undefined): TaskRun[] {
  const [version, setVersion] = useState(0);
  useEffect(() => subscribeTaskRuns(() => setVersion((value) => value + 1)), []);
  useEffect(() => { setVersion((value) => value + 1); }, [taskId]);
  void version;
  return getTaskRunsSnapshot()
    .filter((run) => run.taskId === taskId)
    .slice()
    .sort((a, b) => b.epochMs - a.epochMs);
}
