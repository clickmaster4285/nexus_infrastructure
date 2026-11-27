/** Shared bits for the configuration-changes feature (pages, detail, actions). */

/** True when a value looks like a secret and must be masked in the UI. */
export function isSecretish(path: string): boolean {
  return /(password|passwd|secret|token|api[-_]?key|dsn|private[-_]?key|credential)/i.test(path);
}

/** Masks a before/after value for display; never echoes raw secrets. */
export function maskValue(path: string, value: string): string {
  return isSecretish(path) ? "[REDACTED]" : value;
}

/** `value1 → value2` style one-line diff preview (already masked). */
export function diffSummary(path: string, before: string, after: string): string {
  return `${truncateMiddle(maskValue(path, before), 24)} -> ${truncateMiddle(maskValue(path, after), 24)}`;
}

export function truncateMiddle(value: string, max = 46): string {
  if (value.length <= max) return value;
  const head = Math.ceil((max - 1) / 2);
  const tail = Math.floor((max - 1) / 2);
  return `${value.slice(0, head)}…${value.slice(value.length - tail)}`;
}

/** Build the 7 diff rows around the headline change (3 lines of context either side) — mockup. */
export interface DiffRow { kind: "context" | "removed" | "added"; text: string; }

export function buildDiffRows(change: { path: string; beforeValue: string; afterValue: string }): DiffRow[] {
  const before = maskValue(change.path, change.beforeValue);
  const after = maskValue(change.path, change.afterValue);
  const key = change.path.split(":").pop()?.trim() ?? change.path;
  const win = /registry|HKLM/i.test(change.path);
  return [
    { kind: "context", text: win ? `[key] ${key}` : `# ${key}` },
    { kind: "context", text: `${key}=${before}` },
    { kind: "removed", text: `- ${key}=${before}` },
    { kind: "added", text: `+ ${key}=${after}` },
    { kind: "context", text: win ? "LastWriteTime updated" : "# checksum verified by agent" },
  ];
}

/** Parse "/etc/ssh/sshd_config: PermitRootLogin" → ["/etc/ssh/sshd_config", "PermitRootLogin"]. */
export function splitPath(path: string): [string, string] {
  const index = path.indexOf(":");
  if (index === -1) return [path, ""];
  return [path.slice(0, index).trim(), path.slice(index + 1).trim()];
}
