/**
 * Vulnerabilities & patch status mock — single source of truth.
 * 38 seeded CVEs (ids stable), ops hosts from project mocks, async `load*`
 * with 200–400ms delay. Actions mutate the module store in-memory and write
 * to the shared audit trail. Swap `load*`/`actions` for real API later.
 */
import { servers } from "@/data/mock/servers";
import { logAudit } from "@/mocks/auditLogs";
import { SLA_DAYS, severityFromCvss, slaDueFromFirstSeen, slaStatus, riskScore, type VulnSeverity, type VulnStatus } from "@/utils/vulnStats";

export type { VulnSeverity, VulnStatus } from "@/utils/vulnStats";

export interface Vulnerability {
  cveId: string; title: string; description: string; cvss: number; severity: VulnSeverity;
  exploitAvailable: boolean; knownExploited: boolean;
  publishedAt: string; firstSeenAt: string; slaDueAt: string; status: VulnStatus;
  ownerId: string; affectedHostIds: string[]; fixedInVersion: string; references: string[];
  vector: string; cwe: string;
}
export interface Finding { cveId: string; hostId: string; detectedAt: string; patchedAt: string | null; status: VulnStatus; }
export type PatchStatus = "Released" | "Deploying" | "Scheduled" | "Deployed";
export interface Patch { id: string; name: string; kb: string | null; vendor: string; severity: VulnSeverity; releaseDate: string; rebootRequired: boolean; coversCves: string[]; status: PatchStatus; }
export interface ServerPatchStatus { hostId: string; os: string; osVersion: string; lastScanAt: string; pendingPatches: number; openCritical: number; openHigh: number; openMedium: number; openLow: number; complianceScore: number; rebootPending: boolean; groupId: string; }
export interface PatchRun { id: string; hostId: string; patchId: string; startedAt: string; completedAt: string | null; result: "Success" | "Failed" | "Running"; }
export interface AcceptedRisk { cveId: string; justification: string; approver: string; requestedAt: string; expiresAt: string; }

const HOUR_MS = 3_600_000, DAY = 86_400_000;
const now = Date.now();
const ago = (days: number) => new Date(now - days * DAY).toISOString();
const agoHours = (hours: number) => new Date(now - hours * HOUR_MS).toISOString();
const iso = (days: number) => new Date(now + days * DAY).toISOString();
const owner = (name: string): string => name;

export const VULN_HOSTS = ["api-server-01", "api-server-02", "db-01", "web-app-01", "web-02", "app-server-02", "cache-01", "edge-01", "storage-01", "worker-01"] as const;
export type VulnHostId = (typeof VULN_HOSTS)[number];

const vulnSeeds: Array<Omit<Vulnerability, "severity" | "slaDueAt"> & { firstSeenDaysAgo: number; severity?: VulnSeverity }> = [
  { cveId: "CVE-2026-31431", title: "OpenSSL X.509 name constraint processing RCE", description: "A crafted certificate bypasses name constraints in OpenSSL, allowing remote code execution in TLS termination contexts.", cvss: 9.8, exploitAvailable: true, knownExploited: true, publishedAt: ago(21), firstSeenAt: ago(14), firstSeenDaysAgo: 14, status: "In Progress", ownerId: owner("Sara Iqbal"), affectedHostIds: ["api-server-01", "edge-01", "web-app-01"], fixedInVersion: "OpenSSL 3.0.16", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-31431"], vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", cwe: "CWE-908" },
  { cveId: "CVE-2026-27913", title: "Linux kernel io_uring use-after-free", description: "Local privilege escalation via a race in io_uring fixed file registration on kernels before 6.12.4.", cvss: 9.1, exploitAvailable: true, knownExploited: true, publishedAt: ago(24), firstSeenAt: ago(10), firstSeenDaysAgo: 10, status: "In Progress", ownerId: owner("Tom Becker"), affectedHostIds: ["db-01", "worker-01"], fixedInVersion: "linux 6.12.4", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-27913"], vector: "AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H", cwe: "CWE-416" },
  { cveId: "CVE-2026-21435", title: "Apache httpd mod_rewrite request smuggling", description: "HTTP request smuggling via malformed rewrite rules in mod_rewrite when using proxy mode.", cvss: 9.4, exploitAvailable: true, knownExploited: false, publishedAt: ago(18), firstSeenAt: ago(5), firstSeenDaysAgo: 5, status: "In Progress", ownerId: owner("Marcus Lee"), affectedHostIds: ["web-app-01", "web-02"], fixedInVersion: "httpd 2.4.63", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-21435"], vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", cwe: "CWE-444" },
  { cveId: "CVE-2026-14412", title: "Kubernetes kubelet anonymous auth bypass", description: "Kubelet on worker nodes accepts unauthenticated API requests under specific feature gates, exposing pod exec.", cvss: 9.2, exploitAvailable: true, knownExploited: true, publishedAt: ago(32), firstSeenAt: ago(20), firstSeenDaysAgo: 20, status: "Open", ownerId: owner("Priya Nair"), affectedHostIds: ["worker-01"], fixedInVersion: "kubernetes 1.31.4", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-14412"], vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", cwe: "CWE-288" },
  { cveId: "CVE-2026-22913", title: "PostgreSQL row-level security policy bypass", description: "A superuser function used by row security policies can be abused to read rows from tables the caller should not see.", cvss: 8.9, exploitAvailable: false, knownExploited: false, publishedAt: ago(29), firstSeenAt: ago(21), firstSeenDaysAgo: 21, status: "Open", ownerId: owner("Tom Becker"), affectedHostIds: ["db-01"], fixedInVersion: "postgresql 16.6", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-22913"], vector: "AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H", cwe: "CWE-284" },
  { cveId: "CVE-2026-25041", title: "nginx ngx_http_rewrite_module buffer overflow", description: "Stack buffer overflow in nginx rewrite directives when using captures with PCRE2 JIT enabled.", cvss: 8.6, exploitAvailable: true, knownExploited: false, publishedAt: ago(15), firstSeenAt: ago(8), firstSeenDaysAgo: 8, status: "Open", ownerId: owner("Marcus Lee"), affectedHostIds: ["edge-01", "api-server-01"], fixedInVersion: "nginx 1.27.3", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-25041"], vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", cwe: "CWE-121" },
  { cveId: "CVE-2026-24501", title: "sudo I/O plugin local privilege escalation", description: "A race in sudo's I/O log plugin permits arbitrary file overwrite as root when editors are invoked with specific I/O logging.", cvss: 7.8, exploitAvailable: true, knownExploited: true, publishedAt: ago(27), firstSeenAt: ago(16), firstSeenDaysAgo: 16, status: "Open", ownerId: owner("Sara Iqbal"), affectedHostIds: ["app-server-02", "cache-01"], fixedInVersion: "sudo 1.9.16p1", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-24501"], vector: "AV:L/AC:H/PR:L/UI:R/S:U/C:H/I:H/A:H", cwe: "CWE-367" },
  { cveId: "CVE-2026-19420", title: "runc path traversal in volume mounts", description: "Crafted symlink in container volume destination escapes the mount root and writes to the host filesystem.", cvss: 8.8, exploitAvailable: true, knownExploited: false, publishedAt: ago(26), firstSeenAt: ago(25), firstSeenDaysAgo: 25, status: "Open", ownerId: owner("Priya Nair"), affectedHostIds: ["worker-01", "app-server-02"], fixedInVersion: "runc 1.2.2", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-19420"], vector: "AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H", cwe: "CWE-22" },
  { cveId: "CVE-2026-20171", title: "PHP core unserialize() type confusion", description: "Type confusion in PHP's unserialize allows arbitrary object instantiation, leading to remote code execution.", cvss: 8.9, exploitAvailable: false, knownExploited: false, publishedAt: ago(22), firstSeenAt: ago(12), firstSeenDaysAgo: 12, status: "Open", ownerId: owner("Marcus Lee"), affectedHostIds: ["web-02", "api-server-02"], fixedInVersion: "php 8.3.15", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-20171"], vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:H", cwe: "CWE-943" },
  { cveId: "CVE-2026-16999", title: "Redis Lua sandbox escape", description: "Redis Lua script sandbox can be escaped via deprecated helpers, allowing arbitrary file read/write as the redis user.", cvss: 8.1, exploitAvailable: true, knownExploited: false, publishedAt: ago(13), firstSeenAt: ago(6), firstSeenDaysAgo: 6, status: "Open", ownerId: owner("Tom Becker"), affectedHostIds: ["cache-01"], fixedInVersion: "redis 7.4.2", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-16999"], vector: "AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H", cwe: "CWE-94" },
  { cveId: "CVE-2026-21998", title: "OpenSSH forwarded agent hijack", description: "Under specific SSH client configs, forwarded authentication agent sockets are usable by co-located attackers.", cvss: 8.2, exploitAvailable: false, knownExploited: false, publishedAt: ago(25), firstSeenAt: ago(28), firstSeenDaysAgo: 28, status: "Open", ownerId: owner("Priya Nair"), affectedHostIds: ["app-server-02"], fixedInVersion: "openssh 9.9p2", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-21998"], vector: "AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H", cwe: "CWE-269" },
  { cveId: "CVE-2026-18738", title: "containerd image import path traversal", description: "Malicious layers with absolute symlinks can be extracted outside the containerd root during image import.", cvss: 7.2, exploitAvailable: false, knownExploited: false, publishedAt: ago(45), firstSeenAt: ago(44), firstSeenDaysAgo: 44, status: "Patched", ownerId: owner("Tom Becker"), affectedHostIds: ["worker-01"], fixedInVersion: "containerd 1.7.24", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-18738"], vector: "AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H", cwe: "CWE-22" },
  { cveId: "CVE-2026-24682", title: "Windows SMB client remote code execution", description: "A use-after-free in the Windows SMB client crashes the process or executes code in the context of the user.", cvss: 9.0, exploitAvailable: true, knownExploited: false, publishedAt: ago(11), firstSeenAt: ago(2), firstSeenDaysAgo: 2, status: "Open", ownerId: owner("Sara Iqbal"), affectedHostIds: ["web-app-01", "web-02", "app-server-02"], fixedInVersion: "KB5044414", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-24682"], vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", cwe: "CWE-416" },
  { cveId: "CVE-2026-16350", title: "Squid proxy cache_peer request smuggling", description: "HTTP request smuggling via cache_peer and X-Forwarded-For handling in Squid 6.x reverse proxy mode.", cvss: 6.8, exploitAvailable: false, knownExploited: false, publishedAt: ago(38), firstSeenAt: ago(30), firstSeenDaysAgo: 30, status: "Patched", ownerId: owner("Marcus Lee"), affectedHostIds: ["edge-01"], fixedInVersion: "squid 6.11", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-16350"], vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N", cwe: "CWE-444" },
  { cveId: "CVE-2026-15870", title: "HAProxy HTTP header injection", description: "HAProxy's HTTP/2 handling can be tricked into emitting duplicate headers, leading to cache poisoning.", cvss: 5.8, exploitAvailable: false, knownExploited: false, publishedAt: ago(52), firstSeenAt: ago(51), firstSeenDaysAgo: 51, status: "Patched", ownerId: owner("Tom Becker"), affectedHostIds: ["edge-01"], fixedInVersion: "haproxy 2.9.7", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-15870"], vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N", cwe: "CWE-113" },
  { cveId: "CVE-2026-15110", title: "exim4 local privilege escalation", description: "Exploitation of exim4's retry rules parser permits a race leading to root code execution.", cvss: 5.8, exploitAvailable: false, knownExploited: false, publishedAt: ago(44), firstSeenAt: ago(40), firstSeenDaysAgo: 40, status: "Patched", ownerId: owner("Sara Iqbal"), affectedHostIds: ["storage-01"], fixedInVersion: "exim 4.98-1", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-15110"], vector: "AV:L/AC:H/PR:L/UI:N/S:U/C:H/I:H/A:H", cwe: "CWE-367" },
  { cveId: "CVE-2026-13945", title: "OpenVPN tls-auth bypass", description: "OpenVPN's tls-auth hmac verification can be bypassed with crafted tls-crypt v2 client hellos.", cvss: 6.6, exploitAvailable: false, knownExploited: false, publishedAt: ago(27), firstSeenAt: ago(18), firstSeenDaysAgo: 18, status: "Open", ownerId: owner("Priya Nair"), affectedHostIds: ["edge-01"], fixedInVersion: "openvpn 2.6.12", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-13945"], vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N", cwe: "CWE-347" },
  { cveId: "CVE-2026-12778", title: "Docker Engine API privilege escalation", description: "The legacy Docker API with debug enabled can be tricked into executing privileged containerd actions.", cvss: 5.1, exploitAvailable: false, knownExploited: false, publishedAt: ago(50), firstSeenAt: ago(46), firstSeenDaysAgo: 46, status: "Patched", ownerId: owner("Marcus Lee"), affectedHostIds: ["worker-01"], fixedInVersion: "docker-ce 27.3.1", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-12778"], vector: "AV:L/AC:L/PR:L/UI:N/S:C/C:H/I:H/A:H", cwe: "CWE-863" },
  { cveId: "CVE-2026-12082", title: "MongoDB query injection via $where", description: "$where clauses are evaluated server-side with insufficient sandboxing on MongoDB 7.0.x.", cvss: 8.4, exploitAvailable: true, knownExploited: false, publishedAt: ago(16), firstSeenAt: ago(7), firstSeenDaysAgo: 7, status: "Open", ownerId: owner("Tom Becker"), affectedHostIds: ["db-01"], fixedInVersion: "mongodb 7.0.15", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-12082"], vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:H", cwe: "CWE-89" },
  { cveId: "CVE-2026-11154", title: "rsync incremental file list overflow", description: "Heap buffer overflow in rsync's incremental file list handling with files > 4GB metadata.", cvss: 7.5, exploitAvailable: false, knownExploited: false, publishedAt: ago(30), firstSeenAt: ago(22), firstSeenDaysAgo: 22, status: "Open", ownerId: owner("Sara Iqbal"), affectedHostIds: ["storage-01"], fixedInVersion: "rsync 3.4.1", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-11154"], vector: "AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H", cwe: "CWE-122" },
  { cveId: "CVE-2026-10233", title: "libarchive ISO parser overflow", description: "Integer overflow in libarchive ISO9660 parser leads to out-of-bounds write during archive extraction.", cvss: 6.2, exploitAvailable: false, knownExploited: false, publishedAt: ago(34), firstSeenAt: ago(26), firstSeenDaysAgo: 26, status: "Patched", ownerId: owner("Priya Nair"), affectedHostIds: ["app-server-02", "web-02"], fixedInVersion: "libarchive 3.7.7", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-10233"], vector: "AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:H/A:H", cwe: "CWE-190" },
  { cveId: "CVE-2026-09610", title: "GnuTLS handshake session resumption DoS", description: "GnuTLS session ticket resumption causes null pointer dereferences in the handshake path under memory pressure.", cvss: 6.5, exploitAvailable: false, knownExploited: false, publishedAt: ago(31), firstSeenAt: ago(38), firstSeenDaysAgo: 38, status: "Patched", ownerId: owner("Marcus Lee"), affectedHostIds: ["api-server-02", "edge-01"], fixedInVersion: "gnutls 3.8.8", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-09610"], vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H", cwe: "CWE-476" },
  { cveId: "CVE-2026-08527", title: "systemd-resolved DNS cache poisoning", description: "Response race between TCP and UDP queries in systemd-resolved permits cache poisoning.", cvss: 6.8, exploitAvailable: false, knownExploited: false, publishedAt: ago(28), firstSeenAt: ago(33), firstSeenDaysAgo: 33, status: "Patched", ownerId: owner("Tom Becker"), affectedHostIds: ["edge-01", "api-server-01"], fixedInVersion: "systemd 256.8", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-08527"], vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N", cwe: "CWE-345" },
  { cveId: "CVE-2026-07490", title: "glibc iconv out-of-bounds read", description: "iconv() on attacker-supplied encodings of UTF-32 surrogates triggers an out-of-bounds read.", cvss: 7.5, exploitAvailable: false, knownExploited: false, publishedAt: ago(21), firstSeenAt: ago(42), firstSeenDaysAgo: 42, status: "Patched", ownerId: owner("Priya Nair"), affectedHostIds: ["app-server-02"], fixedInVersion: "glibc 2.40-9ubuntu2", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-07490"], vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N", cwe: "CWE-125" },
  { cveId: "CVE-2026-06231", title: "curl URL path injection via CRLF", description: "curl's URL parser can be tricked into injecting CRLF into HTTP request paths with --next chains.", cvss: 6.4, exploitAvailable: false, knownExploited: false, publishedAt: ago(17), firstSeenAt: ago(9), firstSeenDaysAgo: 9, status: "In Progress", ownerId: owner("Marcus Lee"), affectedHostIds: ["worker-01"], fixedInVersion: "curl 8.11.1", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-06231"], vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N", cwe: "CWE-113" },
  { cveId: "CVE-2026-05884", title: "OpenSSH sshd signal handler race", description: "A race in sshd's signal handler allows mid-connection state corruption on forced command execution.", cvss: 8.2, exploitAvailable: false, knownExploited: false, publishedAt: ago(19), firstSeenAt: ago(3), firstSeenDaysAgo: 3, status: "In Progress", ownerId: owner("Sara Iqbal"), affectedHostIds: ["api-server-02"], fixedInVersion: "openssh 9.9p2", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-05884"], vector: "AV:L/AC:H/PR:H/UI:N/S:U/C:H/I:H/A:H", cwe: "CWE-362" },
  { cveId: "CVE-2026-04442", title: "keepalived VRRP packet injection", description: "keepalived accepts VRRP adverts with invalid auth fields, enabling VRRP master takeover by on-link attackers.", cvss: 5.9, exploitAvailable: false, knownExploited: false, publishedAt: ago(60), firstSeenAt: ago(55), firstSeenDaysAgo: 55, status: "Accepted Risk", ownerId: owner("Tom Becker"), affectedHostIds: ["edge-01"], fixedInVersion: "keepalived 2.3.2", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-04442"], vector: "AV:A/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:H", cwe: "CWE-287" },
  { cveId: "CVE-2026-03117", title: "kdump NFS dump path traversal", description: "kdump's NFS dump target honors symlinks on the remote export, allowing arbitrary file write during crash capture.", cvss: 5.4, exploitAvailable: false, knownExploited: false, publishedAt: ago(58), firstSeenAt: ago(49), firstSeenDaysAgo: 49, status: "Accepted Risk", ownerId: owner("Marcus Lee"), affectedHostIds: ["worker-01"], fixedInVersion: "kdump 1.9.3", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-03117"], vector: "AV:L/AC:L/PR:L/UI:N/S:U/C:L/I:L/A:N", cwe: "CWE-22" },
  { cveId: "CVE-2026-02784", title: "HAProxy PROXY protocol v2 misparsing", description: "PROXY v2 protocol header parsing permits spoofing of source addresses in logs and ACLs.", cvss: 5.3, exploitAvailable: false, knownExploited: false, publishedAt: ago(48), firstSeenAt: ago(35), firstSeenDaysAgo: 35, status: "Ignored", ownerId: owner("Priya Nair"), affectedHostIds: ["edge-01"], fixedInVersion: "haproxy 2.9.7", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-02784"], vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:N", cwe: "CWE-20" },
  { cveId: "CVE-2026-02013", title: "OpenSSL 3.0 stitched decryption overflow", description: "Non-constant-time decryption path in OpenSSL can be abused to forge ciphertext plaintexts.", cvss: 6.7, exploitAvailable: false, knownExploited: false, publishedAt: ago(23), firstSeenAt: ago(52), firstSeenDaysAgo: 52, status: "Patched", ownerId: owner("Sara Iqbal"), affectedHostIds: ["api-server-02", "web-02"], fixedInVersion: "openssl 3.0.16", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-02013"], vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N", cwe: "CWE-755" },
  { cveId: "CVE-2026-00518", title: "OpenSSH AuthorizedKeysCommand injection", description: "Newlines in AuthorizedKeysCommand arguments permit command injection via crafted authorized_keys entries.", cvss: 7.1, exploitAvailable: false, knownExploited: false, publishedAt: ago(26), firstSeenAt: ago(14), firstSeenDaysAgo: 14, status: "Open", ownerId: owner("Tom Becker"), affectedHostIds: ["app-server-02"], fixedInVersion: "openssh 9.9p2", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-00518"], vector: "AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H", cwe: "CWE-78" },
  { cveId: "CVE-2025-55182", title: "Node.js HTTP/2 flood DoS", description: "Rapid reset HTTP/2 streams can exhaust memory on Node.js servers before 20.18.2.", cvss: 7.5, exploitAvailable: true, knownExploited: false, publishedAt: ago(90), firstSeenAt: ago(70), firstSeenDaysAgo: 70, status: "Accepted Risk", ownerId: owner("Marcus Lee"), affectedHostIds: ["api-server-01", "api-server-02"], fixedInVersion: "node 20.18.2", references: ["https://nvd.nist.gov/vuln/detail/CVE-2025-55182"], vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H", cwe: "CWE-400" },
  { cveId: "CVE-2026-13390", title: "PostgreSQL libpq SSL SNI injection", description: "libpq's connection service file mishandles SNI host validation, defeating hostname verification for SSL connections.", cvss: 9.8, exploitAvailable: false, knownExploited: false, publishedAt: ago(75), firstSeenAt: ago(68), firstSeenDaysAgo: 68, status: "Patched", ownerId: owner("Tom Becker"), affectedHostIds: ["db-01"], fixedInVersion: "postgresql 16.6", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-13390"], vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", cwe: "CWE-20" },
  { cveId: "CVE-2026-08902", title: "nginx TLS session ticket flaw", description: "nginx's TLS session ticket key rotation permits session resumption bypass of TLSv1.3 checks.", cvss: 6.1, exploitAvailable: false, knownExploited: false, publishedAt: ago(65), firstSeenAt: ago(60), firstSeenDaysAgo: 60, status: "Patched", ownerId: owner("Marcus Lee"), affectedHostIds: ["edge-01", "api-server-01"], fixedInVersion: "nginx 1.27.3", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-08902"], vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N", cwe: "CWE-287" },
  { cveId: "CVE-2026-04718", title: "Node.js http2 CONTINUATION flood", description: "Continuation-frame floods exhaust memory in nghttp2 with zero-byte payloads before Node.js 20.18.2.", cvss: 7.9, exploitAvailable: false, knownExploited: false, publishedAt: ago(14), firstSeenAt: ago(13), firstSeenDaysAgo: 13, status: "Open", ownerId: owner("Priya Nair"), affectedHostIds: ["api-server-02"], fixedInVersion: "node 20.18.2", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-04718"], vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H", cwe: "CWE-400" },
  { cveId: "CVE-2026-03541", title: "OpenSSL X9.21 signature forgery", description: "DSA-style signature verification in OpenSSL 1.1 accepts malformed signatures due to missing bounds checks.", cvss: 6.9, exploitAvailable: false, knownExploited: false, publishedAt: ago(29), firstSeenAt: ago(27), firstSeenDaysAgo: 27, status: "In Progress", ownerId: owner("Sara Iqbal"), affectedHostIds: ["storage-01"], fixedInVersion: "openssl 3.0.16", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-03541"], vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N", cwe: "CWE-20" },
  { cveId: "CVE-2026-01984", title: "Go crypto/tls GODEBUG leak", description: "Go's crypto/tls can be made to reuse internal randomness across connections via a specific GODEBUG=x509sha1 setting chain.", cvss: 4.2, exploitAvailable: false, knownExploited: false, publishedAt: ago(36), firstSeenAt: ago(48), firstSeenDaysAgo: 48, status: "Open", ownerId: owner("Tom Becker"), affectedHostIds: ["worker-01"], fixedInVersion: "go 1.23.4", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-01984"], vector: "AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N", cwe: "CWE-330" },
  { cveId: "CVE-2026-03992", title: "rsync 3.4 zstd bomb", description: "Crafted zstd payloads trigger decompression bombs in rsync, exhausting disk when --compress=zstd is used.", cvss: 5.5, exploitAvailable: false, knownExploited: false, publishedAt: ago(62), firstSeenAt: ago(57), firstSeenDaysAgo: 57, status: "Patched", ownerId: owner("Priya Nair"), affectedHostIds: ["storage-01"], fixedInVersion: "rsync 3.4.1", references: ["https://nvd.nist.gov/vuln/detail/CVE-2026-03992"], vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H", cwe: "CWE-400" },
  { cveId: "CVE-2025-49126", title: "PHP imap2 stream parsing flaw", description: "PHP's imap extension mishandles stream closing in certain AUTHENTICATE flows, leaking authenticated sessions.", cvss: 8.0, exploitAvailable: false, knownExploited: false, publishedAt: ago(100), firstSeenAt: ago(85), firstSeenDaysAgo: 85, status: "Patched", ownerId: owner("Marcus Lee"), affectedHostIds: ["web-02"], fixedInVersion: "php 8.3.15", references: ["https://nvd.nist.gov/vuln/detail/CVE-2025-49126"], vector: "AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H", cwe: "CWE-269" },
];
void agoHours;

export const VULNS: Vulnerability[] = vulnSeeds.map((seed) => ({
  ...seed,
  severity: severityFromCvss(seed.cvss),
  slaDueAt: slaDueFromFirstSeen(seed.firstSeenAt, severityFromCvss(seed.cvss)),
}));

export const FINDINGS: Finding[] = VULNS.flatMap((vuln) =>
  vuln.affectedHostIds.map((hostId, index) => {
    const patchedAt = vuln.status === "Patched" ? new Date(Date.parse(vuln.firstSeenAt) + (3 + ((index * 7 + hostId.length * 5) % 14)) * DAY).toISOString() : null;
    return { cveId: vuln.cveId, hostId, detectedAt: vuln.firstSeenAt, patchedAt, status: vuln.status };
  }),
);

const hostOpenCounts = (hostId: string) => {
  const findings = FINDINGS.filter((finding) => finding.hostId === hostId && finding.status !== "Patched" && finding.status !== "Ignored");
  const openCritical = findings.filter((finding) => VULNS.find((v) => v.cveId === finding.cveId)?.severity === "Critical").length;
  const openHigh = findings.filter((finding) => VULNS.find((v) => v.cveId === finding.cveId)?.severity === "High").length;
  const openMedium = findings.filter((finding) => VULNS.find((v) => v.cveId === finding.cveId)?.severity === "Medium").length;
  const openLow = findings.filter((finding) => VULNS.find((v) => v.cveId === finding.cveId)?.severity === "Low").length;
  return { openCritical, openHigh, openMedium, openLow };
};

export const SERVER_PATCH_STATUS: ServerPatchStatus[] = VULN_HOSTS.map((hostId, index) => {
  const open = hostOpenCounts(hostId);
  const patchedHere = FINDINGS.filter((finding) => finding.hostId === hostId && finding.status === "Patched").length;
  const osByHost: Record<string, { os: string; osVersion: string }> = {
    "api-server-01": { os: "Ubuntu 22.04 LTS", osVersion: "22.04" },
    "api-server-02": { os: "Ubuntu 24.04 LTS", osVersion: "24.04" },
    "db-01": { os: "Debian 12", osVersion: "12" },
    "web-app-01": { os: "Windows Server 2022", osVersion: "2022" },
    "web-02": { os: "Windows Server 2022", osVersion: "2022" },
    "app-server-02": { os: "Windows Server 2019", osVersion: "2019" },
    "cache-01": { os: "Ubuntu 22.04 LTS", osVersion: "22.04" },
    "edge-01": { os: "Debian 12", osVersion: "12" },
    "storage-01": { os: "Ubuntu 20.04 LTS", osVersion: "20.04" },
    "worker-01": { os: "Ubuntu 22.04 LTS", osVersion: "22.04" },
  };
  const os = osByHost[hostId];
  return {
    hostId,
    os: os.os,
    osVersion: os.osVersion,
    lastScanAt: hostId === "storage-01" ? ago(7) : agoHours(6 + index),
    pendingPatches: [2, 3, 4, 3, 2, 5, 2, 4, 6, 3][index],
    ...open,
    complianceScore: Math.max(22, Math.min(98, Math.round(90 - open.openCritical * 6 - open.openHigh * 3 - open.openMedium * 1.2 - open.openLow * 0.4 + patchedHere * 0.6))),
    rebootPending: hostId === "worker-01" || hostId === "db-01" || hostId === "app-server-02",
    groupId: ["api-services", "api-services", "database-cluster", "production-web", "production-web", "api-services", "cache-servers", "edge-locations", "storage", "workers"][index],
  };
});

export const PATCHES: Patch[] = [
  { id: "KB-5044414", name: "Windows SMB security update (November 2026)", kb: "KB5044414", vendor: "Microsoft", severity: "Critical", releaseDate: ago(16), rebootRequired: true, coversCves: ["CVE-2026-24682"], status: "Released" },
  { id: "linux-6.12.4", name: "Linux kernel 6.12.4 (io_uring)", kb: null, vendor: "kernel.org", severity: "Critical", releaseDate: ago(23), rebootRequired: true, coversCves: ["CVE-2026-27913"], status: "Released" },
  { id: "openssl-3.0.16", name: "OpenSSL 3.0.16 security release", kb: null, vendor: "OpenSSL", severity: "Critical", releaseDate: ago(21), rebootRequired: false, coversCves: ["CVE-2026-31431", "CVE-2026-02013"], status: "Deployed" },
  { id: "postgresql-16.6", name: "PostgreSQL 16.6 security release", kb: null, vendor: "PostgreSQL Global Development Group", severity: "High", releaseDate: ago(24), rebootRequired: false, coversCves: ["CVE-2026-22913", "CVE-2026-13390"], status: "Released" },
  { id: "runc-1.2.2", name: "runc 1.2.2", kb: null, vendor: "opencontainers", severity: "High", releaseDate: ago(19), rebootRequired: false, coversCves: ["CVE-2026-19420"], status: "Deploying" },
  { id: "sudo-1.9.16p1", name: "sudo 1.9.16p1", kb: null, vendor: "sudo", severity: "High", releaseDate: ago(28), rebootRequired: false, coversCves: ["CVE-2026-24501"], status: "Released" },
  { id: "nginx-1.27.3", name: "nginx 1.27.3 security release", kb: null, vendor: "nginx", severity: "High", releaseDate: ago(17), rebootRequired: true, coversCves: ["CVE-2026-25041"], status: "Released" },
  { id: "php-8.3.15", name: "PHP 8.3.15", kb: null, vendor: "php.net", severity: "High", releaseDate: ago(20), rebootRequired: false, coversCves: ["CVE-2026-20171"], status: "Released" },
  { id: "curl-8.11.1", name: "curl 8.11.1", kb: null, vendor: "curl", severity: "Medium", releaseDate: ago(14), rebootRequired: false, coversCves: ["CVE-2026-06231"], status: "Deploying" },
  { id: "redis-7.4.2", name: "Redis 7.4.2 (Lua fixes)", kb: null, vendor: "Redis", severity: "High", releaseDate: ago(11), rebootRequired: true, coversCves: ["CVE-2026-16999"], status: "Scheduled" },
];

export const PATCH_HISTORY: PatchRun[] = [
  { id: "RUN-5601", hostId: "edge-01", patchId: "openssl-3.0.16", startedAt: agoHours(9), completedAt: agoHours(8), result: "Success" },
  { id: "RUN-5600", hostId: "api-server-02", patchId: "openssl-3.0.16", startedAt: agoHours(30), completedAt: agoHours(29), result: "Success" },
  { id: "RUN-5599", hostId: "web-app-01", patchId: "KB-5044414", startedAt: agoHours(31), completedAt: agoHours(30), result: "Success" },
  { id: "RUN-5598", hostId: "storage-01", patchId: "libarchive-3.7.7", startedAt: ago(2), completedAt: ago(2), result: "Success" },
  { id: "RUN-5597", hostId: "app-server-02", patchId: "gnutls-3.8.8", startedAt: ago(2), completedAt: ago(2), result: "Success" },
  { id: "RUN-5596", hostId: "api-server-02", patchId: "gnutls-3.8.8", startedAt: ago(3), completedAt: ago(3), result: "Success" },
  { id: "RUN-5595", hostId: "worker-01", patchId: "containerd-1.7.24", startedAt: ago(4), completedAt: ago(4), result: "Success" },
  { id: "RUN-5594", hostId: "web-02", patchId: "libarchive-3.7.7", startedAt: ago(4), completedAt: ago(4), result: "Success" },
  { id: "RUN-5593", hostId: "edge-01", patchId: "squid-6.11", startedAt: ago(3), completedAt: ago(3), result: "Success" },
  { id: "RUN-5592", hostId: "db-01", patchId: "postgresql-16.6", startedAt: agoHours(20), completedAt: null, result: "Running" },
  { id: "RUN-5591", hostId: "worker-01", patchId: "runc-1.2.2", startedAt: agoHours(5), completedAt: null, result: "Running" },
  { id: "RUN-5590", hostId: "app-server-02", patchId: "KB-5044414", startedAt: ago(1), completedAt: null, result: "Failed" },
];

export const ACCEPTED_RISKS: AcceptedRisk[] = [
  { cveId: "CVE-2026-04442", justification: "keepalived VRRP auth deprecation accepted; VRRP is isolated to the edge VLAN with no VMAC takeover in scope.", approver: "Tom Becker", requestedAt: ago(35), expiresAt: iso(90) },
  { cveId: "CVE-2026-03117", justification: "kdump requires root to trigger and only dumps on crash; dump target NFS export is read-only.", approver: "Marcus Lee", requestedAt: ago(49), expiresAt: iso(120) },
  { cveId: "CVE-2025-55182", justification: "Node.js upgrade to 20.18.2 scheduled with next maintenance window MW-1053; temporary exposure limited by WAF rule.", approver: "Sara Iqbal", requestedAt: ago(70), expiresAt: iso(14) },
];

interface VulnStore {
  vulns: Vulnerability[];
  findings: Finding[];
  patches: Patch[];
  serverPatchStatus: ServerPatchStatus[];
  patchHistory: PatchRun[];
  acceptedRisks: AcceptedRisk[];
}

const store: VulnStore = {
  vulns: VULNS.map((v) => ({ ...v, references: [...v.references], affectedHostIds: [...v.affectedHostIds] })),
  findings: FINDINGS.map((f) => ({ ...f })),
  patches: PATCHES.map((p) => ({ ...p })),
  serverPatchStatus: SERVER_PATCH_STATUS.map((s) => ({ ...s })),
  patchHistory: PATCH_HISTORY.map((r) => ({ ...r })),
  acceptedRisks: ACCEPTED_RISKS.map((a) => ({ ...a })),
};

export interface VulnSummary {
  open: number;
  criticalHigh: number;
  knownExploited: number;
  compliancePct: number;
  overdue: number;
  mttpDays: number;
  patched: number;
  inProgress: number;
  acceptedRisk: number;
  pendingPatches: number;
  rebootPending: number;
  staleScans: number;
}

export function computeVulnSummary(nowMs = Date.now()): VulnSummary {
  const openList = store.vulns.filter((vuln) => vuln.status !== "Patched");
  const criticalHigh = openList.filter((vuln) => vuln.severity === "Critical" || vuln.severity === "High").length;
  const knownExploited = store.vulns.filter((vuln) => vuln.knownExploited).length;
  const overdue = openList.filter((vuln) => slaStatus(vuln.slaDueAt, vuln.status, nowMs) === "Overdue").length;
  const patchedCount = store.vulns.filter((vuln) => vuln.status === "Patched").length;
  const inProgress = store.vulns.filter((vuln) => vuln.status === "In Progress").length;
  const acceptedRisk = store.vulns.filter((vuln) => vuln.status === "Accepted Risk").length;
  const patchedFindings = store.findings.filter((finding) => finding.status === "Patched" && finding.patchedAt);
  const mttpDays = patchedFindings.length === 0 ? 9.1 : Math.round((patchedFindings.reduce((acc, finding) => acc + (Date.parse(finding.patchedAt as string) - Date.parse(finding.detectedAt)) / DAY, 0) / patchedFindings.length) * 10) / 10;
  const compliancePct = Math.round(store.serverPatchStatus.reduce((acc, host) => acc + host.complianceScore, 0) / store.serverPatchStatus.length);
  const pendingPatches = store.serverPatchStatus.reduce((acc, host) => acc + host.pendingPatches, 0);
  return {
    open: openList.length,
    criticalHigh,
    knownExploited,
    compliancePct,
    overdue,
    mttpDays,
    patched: patchedCount,
    inProgress,
    acceptedRisk,
    pendingPatches,
    rebootPending: store.serverPatchStatus.filter((host) => host.rebootPending).length,
    staleScans: store.serverPatchStatus.filter((host) => nowMs - Date.parse(host.lastScanAt) > 7 * DAY).length,
  };
}

export const VULN_SUMMARY = computeVulnSummary();

export async function loadVulnerabilities(): Promise<Vulnerability[]> {
  await new Promise((resolve) => setTimeout(resolve, 240 + Math.random() * 160));
  return store.vulns.map((vuln) => ({ ...vuln, affectedHostIds: [...vuln.affectedHostIds], references: [...vuln.references] }));
}
export async function loadFindings(): Promise<Finding[]> {
  await new Promise((resolve) => setTimeout(resolve, 220 + Math.random() * 180));
  return store.findings.map((finding) => ({ ...finding }));
}
export async function loadPatches(): Promise<Patch[]> {
  await new Promise((resolve) => setTimeout(resolve, 210 + Math.random() * 190));
  return store.patches.map((patch) => ({ ...patch }));
}
export async function loadServerPatchStatus(): Promise<ServerPatchStatus[]> {
  await new Promise((resolve) => setTimeout(resolve, 230 + Math.random() * 170));
  return store.serverPatchStatus.map((host) => ({ ...host }));
}
export async function loadPatchHistory(): Promise<PatchRun[]> {
  await new Promise((resolve) => setTimeout(resolve, 220 + Math.random() * 180));
  return store.patchHistory.map((run) => ({ ...run }));
}
export async function loadAcceptedRisks(): Promise<AcceptedRisk[]> {
  await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 200));
  return store.acceptedRisks.map((risk) => ({ ...risk }));
}

export function getVulnSummary(): VulnSummary {
  return computeVulnSummary();
}

export function getVulnerabilityById(cveId: string): Vulnerability | undefined {
  const vuln = store.vulns.find((item) => item.cveId === cveId);
  return vuln ? { ...vuln, affectedHostIds: [...vuln.affectedHostIds], references: [...vuln.references] } : undefined;
}

export function getServerPatchById(hostId: string): ServerPatchStatus | undefined {
  const host = store.serverPatchStatus.find((item) => item.hostId === hostId);
  return host ? { ...host } : undefined;
}

const CURRENT_USER = "Ayesha Khan";

export function assignVulnerability(cveId: string, ownerId: string): void {
  const vuln = store.vulns.find((item) => item.cveId === cveId);
  if (!vuln) return;
  vuln.ownerId = ownerId;
  logAudit({ actor: { id: "ACC-02", name: CURRENT_USER, type: "Human", role: "Operations" }, action: "Assigned vulnerability", category: "Security", resource: { type: "Vulnerability", id: cveId, name: cveId }, result: "Success" });
}

export function markVulnerabilityPatched(cveId: string, note = "Patched via dashboard"): void {
  const vuln = store.vulns.find((item) => item.cveId === cveId);
  if (!vuln) return;
  vuln.status = "Patched";
  for (const finding of store.findings) {
    if (finding.cveId === cveId && finding.status !== "Patched") {
      finding.status = "Patched";
      finding.patchedAt = new Date().toISOString();
    }
  }
  logAudit({ actor: { id: "ACC-02", name: CURRENT_USER, type: "Human", role: "Operations" }, action: "Marked vulnerability patched", category: "Security", resource: { type: "Vulnerability", id: cveId, name: cveId }, result: "Success", reason: note });
}

export function acceptVulnerabilityRisk(cveId: string, input: { justification: string; expiresAt: string; approver: string }): void {
  const vuln = store.vulns.find((item) => item.cveId === cveId);
  if (!vuln) return;
  vuln.status = "Accepted Risk";
  store.acceptedRisks.unshift({ cveId, justification: input.justification.trim(), approver: input.approver, requestedAt: new Date().toISOString(), expiresAt: input.expiresAt });
  for (const finding of store.findings) {
    if (finding.cveId === cveId && finding.status !== "Patched") finding.status = "Accepted Risk";
  }
  logAudit({ actor: { id: "ACC-02", name: CURRENT_USER, type: "Human", role: "Operations" }, action: "Accepted risk", category: "Security", resource: { type: "Vulnerability", id: cveId, name: cveId }, result: "Success", reason: input.justification.trim() });
}

export interface DeployResult { patchId: string; hosts: string[]; startedAt: string; }

export function deployPatch(patchId: string, hosts: string[]): DeployResult {
  const patch = store.patches.find((item) => item.id === patchId);
  if (patch) patch.status = "Deploying";
  for (const hostId of hosts) {
    store.patchHistory.unshift({ id: `RUN-${Math.floor(5600 + Math.random() * 900)}`, hostId, patchId, startedAt: new Date().toISOString(), completedAt: null, result: "Running" });
  }
  logAudit({ actor: { id: "ACC-02", name: CURRENT_USER, type: "Human", role: "Operations" }, action: "Deployed patch", category: "Security", resource: { type: "Patch", id: patchId, name: patchId }, result: "Success", reason: `Deploying to ${hosts.length} ${hosts.length === 1 ? "host" : "hosts"}` });
  return { patchId, hosts, startedAt: new Date().toISOString() };
}

export function completePatchRuns(hostIds: string[], patchId: string): void {
  for (const run of store.patchHistory) {
    if (run.patchId === patchId && hostIds.includes(run.hostId) && run.result === "Running") {
      run.result = "Success";
      run.completedAt = new Date().toISOString();
    }
  }
  const patch = store.patches.find((item) => item.id === patchId);
  if (patch) {
    patch.status = "Deployed";
    for (const cveId of patch.coversCves) markVulnerabilityPatched(cveId, `Patch ${patchId} deployed`);
  }
}
