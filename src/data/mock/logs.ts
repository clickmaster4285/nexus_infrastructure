import { useEffect, useMemo, useState } from "react";

export type LogLevel = "ERROR" | "WARNING" | "INFO" | "DEBUG";
export type LogEntry = { id: string; timestamp: string; level: LogLevel; service: string; host: string; environment: string; message: string; tags: string[]; traceId: string; source: string; raw: Record<string, unknown> };
export const LOG_TOTALS = { total: 48_742_893, parsed: 48_100_000, errors: 124_500, warnings: 268_700 } as const;
const services = ["api-server", "web-app", "auth-service", "payments", "worker", "database"];
const messages = ["Database connection lost. Retrying request", "High memory usage detected", "User login successful", "Query executed in 42ms", "Payment API response delayed", "Cache hit for key"];
const levels: LogLevel[] = ["ERROR", "WARNING", "INFO", "DEBUG"];
export function createMockLogs(count = 500): LogEntry[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, index) => { const level = levels[index % levels.length]; const timestamp = new Date(now - index * 73_000).toISOString(); const service = services[index % services.length]; const message = messages[index % messages.length]; return { id: `log-${index + 1}`, timestamp, level, service, host: `${service.split("-")[0]}-${String((index % 4) + 1).padStart(2, "0")}`, environment: index % 5 === 0 ? "staging" : "prod", message, tags: [level.toLowerCase(), service.split("-")[0]], traceId: `tr-${(index + 1000).toString(16)}`, source: index % 2 ? "agent" : "application", raw: { timestamp, level, service, message, traceId: `tr-${(index + 1000).toString(16)}` } }; });
}
export const MOCK_LOGS = createMockLogs();
export function useLogs() { const [state, setState] = useState<{ logs: LogEntry[]; loading: boolean; error: string | null }>({ logs: [], loading: true, error: null }); useEffect(() => { const timer = window.setTimeout(() => setState({ logs: MOCK_LOGS, loading: false, error: null }), 280); return () => window.clearTimeout(timer); }, []); return useMemo(() => state, [state]); }
