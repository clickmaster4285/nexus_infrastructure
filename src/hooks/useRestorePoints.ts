"use client";

import { useEffect, useState } from "react";

import { getRestoreHistorySnapshot, subscribeRestoreHistory } from "@/mocks/restoreHistory";
import { getRestorePointsSnapshot, restorePointsForHost, type RestorePoint } from "@/mocks/restorePoints";

export function useRestorePoints(host?: string | null): RestorePoint[] {
  const [version, setVersion] = useState(0);
  useEffect(() => subscribeRestoreHistory(() => setVersion((value) => value + 1)), []);
  useEffect(() => { setVersion((value) => value + 1); }, [host]);
  void version;
  if (host) return restorePointsForHost(host);
  return getRestorePointsSnapshot();
}

export function useRestoreOperations() {
  const [version, setVersion] = useState(0);
  useEffect(() => subscribeRestoreHistory(() => setVersion((value) => value + 1)), []);
  void version;
  return getRestoreHistorySnapshot().slice().sort((a, b) => b.epochMs - a.epochMs);
}
