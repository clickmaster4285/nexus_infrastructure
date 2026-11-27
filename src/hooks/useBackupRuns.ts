"use client";

import { useEffect, useState } from "react";

import { getBackupRunsSnapshot, subscribeBackupRuns, type BackupRun } from "@/mocks/backupRuns";

/**
 * Run history for one backup job, newest first. Subscribes to the runs store so a
 * `runNow` action appears immediately without a refetch.
 */
export function useBackupRuns(jobId: string | null | undefined): BackupRun[] {
  const [version, setVersion] = useState(0);
  useEffect(() => subscribeBackupRuns(() => setVersion((value) => value + 1)), []);
  useEffect(() => { setVersion((value) => value + 1); }, [jobId]);
  void version;
  return getBackupRunsSnapshot()
    .filter((run) => run.jobId === jobId)
    .slice()
    .sort((a, b) => b.epochMs - a.epochMs);
}
