/**
 * Access Control hooks — client-side companions to `mocks/accessControl.ts`.
 * Same pattern as `useVulnerabilities`: 200-400ms fetch, reload, in-memory actions.
 */
"use client";

import { useCallback, useEffect, useState } from "react";

import {
  loadUsers, loadRoles, loadApiTokens, loadAccessAudit,
  type User, type Role, type ApiToken, type AccessAuditEntry,
  suspendUser, reactivateUser, requireMfa, assignRole, removeRole, resetPassword, revokeSession, revokeAllSessions, deleteUser,
  rotateToken, revokeToken, createToken, inviteUser, resendInvite, cancelInvite, getUserById, getRoleById, getTokenById,
  DEMO_CURRENT_USER,
} from "@/mocks/accessControl";

export type LoadStatus = "loading" | "error" | "success";

function useAsync<T>(loader: () => Promise<T>): { data: T | null; status: LoadStatus; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    const forcedError = typeof window !== "undefined" && window.location.search.includes("accessError=1");
    const timer = window.setTimeout(() => {
      if (forcedError && attempt === 0) { if (!cancelled) setStatus("error"); return; }
      loader().then((result) => { if (!cancelled) { setData(result); setStatus("success"); } }).catch(() => { if (!cancelled) setStatus("error"); });
    }, 220);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [attempt]);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { data, status, reload };
}

export function useUsers(): { users: User[]; status: LoadStatus; reload: () => void } {
  const { data, status, reload } = useAsync(loadUsers);
  return { users: data ?? [], status, reload };
}

export function useUser(id: string): { user: User | null; status: LoadStatus; reload: () => void } {
  const { data, status, reload } = useAsync(loadUsers);
  const user = (data ?? []).find((item) => item.id === id) ?? null;
  return { user, status, reload };
}

export function useRoles(): { roles: Role[]; status: LoadStatus; reload: () => void } {
  const { data, status, reload } = useAsync(loadRoles);
  return { roles: data ?? [], status, reload };
}

export function useRole(id: string): { role: Role | null; status: LoadStatus; reload: () => void } {
  const { data, status, reload } = useAsync(loadRoles);
  const role = (data ?? []).find((item) => item.id === id) ?? null;
  return { role, status, reload };
}

export function useApiTokens(): { tokens: ApiToken[]; status: LoadStatus; reload: () => void } {
  const { data, status, reload } = useAsync(loadApiTokens);
  return { tokens: data ?? [], status, reload };
}

export function useAccessAudit(): { audit: AccessAuditEntry[]; status: LoadStatus; reload: () => void } {
  const { data, status, reload } = useAsync(loadAccessAudit);
  return { audit: data ?? [], status, reload };
}

export const accessActions = {
  suspendUser, reactivateUser, requireMfa, assignRole, removeRole, resetPassword, revokeSession, revokeAllSessions,
  deleteUser, rotateToken, revokeToken, createToken, inviteUser, resendInvite, cancelInvite,
};
export { DEMO_CURRENT_USER };
