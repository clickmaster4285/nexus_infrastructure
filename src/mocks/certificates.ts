/**
 * Certificates & expiration mock — single source of truth.
 * 32 seeded certificates with stable ids (CRT-4101..), expiry status DERIVED
 * from expiresAt (never hardcoded). Swap `load*` for real `/api/certs` later.
 */
import { servers } from "@/data/mock/servers";
import { logAudit } from "@/mocks/auditLogs";
import { daysUntilExpiry, expiryStatus, healthScore, type CertStatus } from "@/utils/certStats";

export type CertIssuerType = "Public CA" | "Internal CA" | "Self-signed";
export type CertRenewalMethod = "ACME" | "Manual" | "Vendor";
export type CertEventType = "renewed" | "deployed" | "expiring" | "revoked" | "scan" | "alert";

export interface Certificate {
  id: string;
  commonName: string;
  sans: string[];
  issuer: string;
  issuerType: CertIssuerType;
  serial: string;
  fingerprintSha256: string;
  signatureAlgorithm: string;
  keyType: "RSA" | "ECDSA";
  keySize: number;
  issuedAt: string;
  expiresAt: string;
  status: CertStatus;
  autoRenew: boolean;
  renewalMethod: CertRenewalMethod;
  ownerId: string;
  environment: "Production" | "Staging" | "Development";
  hostIds: string[];
  service: string;
  port: number;
  chainValid: boolean;
  revoked: boolean;
  lastCheckedAt: string;
  tags: string[];
}

export interface CertificateEvent {
  id: string;
  certId: string;
  type: CertEventType;
  at: string;
  actor: string;
  detail: string;
}

export interface ExpiryAlertPolicy {
  id: string;
  name: string;
  thresholds: number[];
  channels: Array<"Email" | "Slack" | "PagerDuty">;
  enabled: boolean;
  appliesTo: string;
}

const DAY = 86_400_000, HOUR = 3_600_000;
const now = Date.now();
const ago = (days: number) => new Date(now - days * DAY).toISOString();
const ahead = (days: number) => new Date(now + days * DAY).toISOString();
const agoHours = (hours: number) => new Date(now - hours * HOUR).toISOString();
const fp = (seed: number) => Array.from({ length: 32 }, (_, i) => ((seed * 2654435761 + i * 40503) >>> 0).toString(16).padStart(8, "0")).join(":").slice(0, 64);

interface CertSeed extends Omit<Certificate, "status" | "lastCheckedAt" | "chainValid"> {
  chainValid?: boolean;
  lastCheckedHoursAgo?: number;
}

const SEEDS: CertSeed[] = [
  { id: "CRT-4101", commonName: "api.nexus.io", sans: ["api.nexus.io", "api2.nexus.io", "grpc.nexus.io"], issuer: "Let's Encrypt", issuerType: "Public CA", serial: "0x04:A1:F2:9C:07:3E:11:B0:55:C8:09:7E:CD:18:2F", fingerprintSha256: fp(4101), signatureAlgorithm: "SHA256-RSA", keyType: "RSA", keySize: 2048, issuedAt: ago(60), expiresAt: ahead(305), autoRenew: true, renewalMethod: "ACME", ownerId: "Priya Nair", environment: "Production", hostIds: ["api-server-01", "api-server-02"], service: "HTTPS/REST", port: 443, tags: ["api", "production"], revoked: false },
  { id: "CRT-4102", commonName: "*.nexus.io", sans: ["*.nexus.io", "nexus.io"], issuer: "DigiCert", issuerType: "Public CA", serial: "0x09:11:C4:77:E2:0A:3B:40:12:9E:8F:6C:04:72", fingerprintSha256: fp(4102), signatureAlgorithm: "SHA256-RSA", keyType: "RSA", keySize: 2048, issuedAt: ago(200), expiresAt: ahead(165), autoRenew: true, renewalMethod: "Vendor", ownerId: "Sara Iqbal", environment: "Production", hostIds: ["edge-01"], service: "CDN/TLS", port: 443, tags: ["wildcard", "edge"], revoked: false },
  { id: "CRT-4103", commonName: "db-01.internal.nexus.io", sans: ["db-01.internal.nexus.io", "db-primary.nexus.internal"], issuer: "Internal CA", issuerType: "Internal CA", serial: "0x02:7B:E1:09:55:C0:30:44:1A:6D:88:0C:12:3B:01", fingerprintSha256: fp(4103), signatureAlgorithm: "SHA256-ECDSA", keyType: "ECDSA", keySize: 256, issuedAt: ago(120), expiresAt: ahead(245), autoRenew: true, renewalMethod: "ACME", ownerId: "Tom Becker", environment: "Production", hostIds: ["db-01"], service: "PostgreSQL", port: 5432, chainValid: true, tags: ["internal", "database"], revoked: false },
  { id: "CRT-4104", commonName: "web-app-01.nexus.io", sans: ["web-app-01.nexus.io", "shop.nexus.io"], issuer: "Let's Encrypt", issuerType: "Public CA", serial: "0x05:C2:11:4D:88:F1:70:93:2E:A0:5B:6C:31:19:4A", fingerprintSha256: fp(4104), signatureAlgorithm: "SHA256-RSA", keyType: "RSA", keySize: 2048, issuedAt: ago(335), expiresAt: ahead(-4), autoRenew: true, renewalMethod: "ACME", ownerId: "Marcus Lee", environment: "Production", hostIds: ["web-app-01"], service: "HTTPS/Web", port: 443, tags: ["web", "production"], revoked: false },
  { id: "CRT-4105", commonName: "edge-01.cdn.nexus.io", sans: ["edge-01.cdn.nexus.io", "cdn.nexus.io", "static.nexus.io"], issuer: "Sectigo", issuerType: "Public CA", serial: "0x08:9A:33:E5:70:12:BC:4D:07:61:F0:8E:92:24:DD", fingerprintSha256: fp(4105), signatureAlgorithm: "SHA256-RSA", keyType: "RSA", keySize: 2048, issuedAt: ago(28), expiresAt: ahead(2), autoRenew: true, renewalMethod: "ACME", ownerId: "Priya Nair", environment: "Production", hostIds: ["edge-01"], service: "CDN", port: 443, tags: ["cdn", "edge"], revoked: false },
  { id: "CRT-4106", commonName: "mail.nexus.io", sans: ["mail.nexus.io", "autodiscover.nexus.io"], issuer: "DigiCert", issuerType: "Public CA", serial: "0x0A:47:01:92:BB:5C:3F:28:E8:16:AC:70:D1:64:53", fingerprintSha256: fp(4106), signatureAlgorithm: "SHA256-RSA", keyType: "RSA", keySize: 2048, issuedAt: ago(240), expiresAt: ahead(118), autoRenew: true, renewalMethod: "Vendor", ownerId: "Sara Iqbal", environment: "Production", hostIds: ["edge-01"], service: "SMTP", port: 993, tags: ["mail", "edge"], revoked: false },
  { id: "CRT-4107", commonName: "vpn.nexus.io", sans: ["vpn.nexus.io", "gateway.nexus.io"], issuer: "Let's Encrypt", issuerType: "Public CA", serial: "0x03:D8:86:12:4C:79:0A:B5:F6:32:8E:19:CD:07:2B", fingerprintSha256: fp(4107), signatureAlgorithm: "SHA256-RSA", keyType: "RSA", keySize: 2048, issuedAt: ago(300), expiresAt: ahead(65), autoRenew: true, renewalMethod: "ACME", ownerId: "Tom Becker", environment: "Production", hostIds: ["edge-01", "app-server-02"], service: "VPN", port: 1194, tags: ["vpn", "security"], revoked: false },
  { id: "CRT-4108", commonName: "internal.nexus.io", sans: ["internal.nexus.io", "*.internal.nexus.io", "vault.nexus.internal"], issuer: "Internal CA", issuerType: "Internal CA", serial: "0x01:5E:2A:77:80:C4:96:E1:33:5F:B8:07:AA:52:19", fingerprintSha256: fp(4108), signatureAlgorithm: "SHA256-ECDSA", keyType: "ECDSA", keySize: 384, issuedAt: ago(90), expiresAt: ahead(275), autoRenew: true, renewalMethod: "ACME", ownerId: "Priya Nair", environment: "Production", hostIds: ["auth-01"], service: "SSO", port: 8443, tags: ["internal", "sso", "ca"], revoked: false },
  { id: "CRT-4109", commonName: "app-server-02.internal.nexus.io", sans: ["app-server-02.internal.nexus.io"], issuer: "Self-signed", issuerType: "Self-signed", serial: "0x06:F3:90:C7:58:E4:2B:07:14:67:9A:D5:88:30:C6", fingerprintSha256: fp(4109), signatureAlgorithm: "SHA256-RSA", keyType: "RSA", keySize: 1024, issuedAt: ago(180), expiresAt: ahead(-12), autoRenew: false, renewalMethod: "Manual", ownerId: "Marcus Lee", environment: "Staging", hostIds: ["app-server-02"], service: "RDP", port: 3389, tags: ["staging", "windows", "legacy"], revoked: false },
  { id: "CRT-4110", commonName: "cache-01.internal.nexus.io", sans: ["cache-01.internal.nexus.io", "redis-01.nexus.internal"], issuer: "Internal CA", issuerType: "Internal CA", serial: "0x07:B5:63:41:99:1D:8F:20:E6:74:0C:5B:3A:87:F1", fingerprintSha256: fp(4110), signatureAlgorithm: "SHA256-ECDSA", keyType: "ECDSA", keySize: 256, issuedAt: ago(70), expiresAt: ahead(4), autoRenew: true, renewalMethod: "ACME", ownerId: "Tom Becker", environment: "Production", hostIds: ["cache-01"], service: "Redis", port: 6379, tags: ["cache", "internal"], revoked: false },
  { id: "CRT-4111", commonName: "storage-01.nexus.io", sans: ["storage-01.nexus.io", "backup.nexus.io"], issuer: "DigiCert", issuerType: "Public CA", serial: "0x02:9F:D0:36:A7:48:E1:5C:90:B2:64:18:7C:03:5D", fingerprintSha256: fp(4111), signatureAlgorithm: "SHA256-RSA", keyType: "RSA", keySize: 2048, issuedAt: ago(150), expiresAt: ahead(22), autoRenew: false, renewalMethod: "Vendor", ownerId: "Priya Nair", environment: "Production", hostIds: ["storage-01"], service: "NFS/Backup", port: 2049, tags: ["storage", "backup"], revoked: false },
  { id: "CRT-4112", commonName: "worker-01.internal.nexus.io", sans: ["worker-01.internal.nexus.io", "ci.nexus.internal"], issuer: "Internal CA", issuerType: "Internal CA", serial: "0x0B:68:42:DE:0C:7A:B3:E8:51:9F:27:A6:C0:44:89", fingerprintSha256: fp(4112), signatureAlgorithm: "SHA256-ECDSA", keyType: "ECDSA", keySize: 256, issuedAt: ago(95), expiresAt: ahead(188), autoRenew: true, renewalMethod: "ACME", ownerId: "Marcus Lee", environment: "Production", hostIds: ["worker-01"], service: "CI/CD", port: 443, tags: ["ci", "internal"], revoked: false },
  { id: "CRT-4113", commonName: "status.nexus.io", sans: ["status.nexus.io", "uptime.nexus.io"], issuer: "Let's Encrypt", issuerType: "Public CA", serial: "0x09:13:E4:78:26:AD:54:0F:8B:C6:01:97:3D:2A:E5", fingerprintSha256: fp(4113), signatureAlgorithm: "SHA256-RSA", keyType: "RSA", keySize: 2048, issuedAt: ago(25), expiresAt: ahead(65), autoRenew: true, renewalMethod: "ACME", ownerId: "Sara Iqbal", environment: "Production", hostIds: ["edge-01"], service: "Status page", port: 443, tags: ["public", "status"], revoked: false },
  { id: "CRT-4114", commonName: "grafana.internal.nexus.io", sans: ["grafana.internal.nexus.io", "monitoring.internal.nexus.io"], issuer: "Self-signed", issuerType: "Self-signed", serial: "0x04:81:37:65:FA:02:6C:B9:45:18:D7:E0:AA:59:3F", fingerprintSha256: fp(4114), signatureAlgorithm: "SHA1-RSA", keyType: "RSA", keySize: 1024, issuedAt: ago(400), expiresAt: ahead(-90), autoRenew: false, renewalMethod: "Manual", ownerId: "Tom Becker", environment: "Development", hostIds: ["app-server-02"], service: "Grafana", port: 3000, chainValid: false, tags: ["monitoring", "legacy", "weak"], revoked: false },
  { id: "CRT-4115", commonName: "auth.nexus.io", sans: ["auth.nexus.io", "sso.nexus.io", "identity.nexus.io"], issuer: "DigiCert", issuerType: "Public CA", serial: "0x05:C1:58:0D:23:EF:47:91:B4:76:02:A8:F5:68:31", fingerprintSha256: fp(4115), signatureAlgorithm: "SHA256-RSA", keyType: "RSA", keySize: 2048, issuedAt: ago(210), expiresAt: ahead(155), autoRenew: true, renewalMethod: "Vendor", ownerId: "Priya Nair", environment: "Production", hostIds: ["auth-01"], service: "OIDC", port: 8443, tags: ["auth", "sso"], revoked: false },
  { id: "CRT-4116", commonName: "dev.nexus.io", sans: ["dev.nexus.io", "*.dev.nexus.io"], issuer: "Let's Encrypt", issuerType: "Public CA", serial: "0x07:64:09:B2:18:AC:35:E6:70:41:D9:5F:23:86:CA", fingerprintSha256: fp(4116), signatureAlgorithm: "SHA256-RSA", keyType: "RSA", keySize: 2048, issuedAt: ago(350), expiresAt: ahead(15), autoRenew: false, renewalMethod: "ACME", ownerId: "Marcus Lee", environment: "Development", hostIds: ["app-server-02"], service: "HTTPS", port: 443, tags: ["dev", "staging"], revoked: false },
  { id: "CRT-4117", commonName: "registry.nexus.io", sans: ["registry.nexus.io"], issuer: "Internal CA", issuerType: "Internal CA", serial: "0x03:30:E7:5A:41:8C:00:96:D2:75:4B:1F:67:10:92", fingerprintSha256: fp(4117), signatureAlgorithm: "SHA256-ECDSA", keyType: "ECDSA", keySize: 256, issuedAt: ago(45), expiresAt: ahead(320), autoRenew: true, renewalMethod: "ACME", ownerId: "Tom Becker", environment: "Production", hostIds: ["worker-01"], service: "Docker registry", port: 5000, tags: ["ci", "internal"], revoked: false },
  { id: "CRT-4118", commonName: "api2.nexus.io", sans: ["api2.nexus.io"], issuer: "Sectigo", issuerType: "Public CA", serial: "0x08:BC:24:6D:9E:51:F3:08:42:A5:79:C0:16:E7:48", fingerprintSha256: fp(4118), signatureAlgorithm: "SHA256-RSA", keyType: "RSA", keySize: 2048, issuedAt: ago(275), expiresAt: ahead(8), autoRenew: true, renewalMethod: "ACME", ownerId: "Sara Iqbal", environment: "Production", hostIds: ["api-server-02"], service: "HTTPS/REST", port: 443, tags: ["api", "production"], revoked: false },
  { id: "CRT-4119", commonName: "db2.internal.nexus.io", sans: ["db2.internal.nexus.io", "db-replica.nexus.internal"], issuer: "Self-signed", issuerType: "Self-signed", serial: "0x01:A0:F5:39:7D:26:C8:10:E3:5B:48:90:02:BF:64", fingerprintSha256: fp(4119), signatureAlgorithm: "SHA1-RSA", keyType: "RSA", keySize: 1024, issuedAt: ago(500), expiresAt: ahead(-45), autoRenew: false, renewalMethod: "Manual", ownerId: "Marcus Lee", environment: "Staging", hostIds: ["db-01"], service: "PostgreSQL", port: 5432, tags: ["staging", "legacy", "weak"], revoked: false },
  { id: "CRT-4120", commonName: "helpdesk.nexus.io", sans: ["helpdesk.nexus.io"], issuer: "DigiCert", issuerType: "Public CA", serial: "0x0A:77:E9:1C:40:B3:68:D5:19:04:FE:22:8A:57:2C", fingerprintSha256: fp(4120), signatureAlgorithm: "SHA256-RSA", keyType: "RSA", keySize: 2048, issuedAt: ago(130), expiresAt: ahead(158), autoRenew: false, renewalMethod: "Vendor", ownerId: "Priya Nair", environment: "Production", hostIds: ["edge-01"], service: "Support portal", port: 443, tags: ["support", "public"], revoked: false },
  { id: "CRT-4121", commonName: "metrics.internal.nexus.io", sans: ["metrics.internal.nexus.io"], issuer: "Internal CA", issuerType: "Internal CA", serial: "0x06:52:08:D1:8E:74:90:F6:28:C4:B1:05:39:DE:70", fingerprintSha256: fp(4121), signatureAlgorithm: "SHA256-ECDSA", keyType: "ECDSA", keySize: 256, issuedAt: ago(32), expiresAt: ahead(340), autoRenew: true, renewalMethod: "ACME", ownerId: "Tom Becker", environment: "Production", hostIds: ["worker-01"], service: "Prometheus", port: 9090, tags: ["metrics", "internal"], revoked: false },
  { id: "CRT-4122", commonName: "backup.nexus.io", sans: ["backup.nexus.io", "dr.nexus.io"], issuer: "Let's Encrypt", issuerType: "Public CA", serial: "0x02:EC:63:24:BA:07:51:8D:F0:96:41:29:67:A8:D3", fingerprintSha256: fp(4122), signatureAlgorithm: "SHA256-RSA", keyType: "RSA", keySize: 2048, issuedAt: ago(88), expiresAt: ahead(16), autoRenew: false, renewalMethod: "ACME", ownerId: "Sara Iqbal", environment: "Production", hostIds: ["storage-01"], service: "Backup UI", port: 443, tags: ["backup", "storage"], revoked: false },
  { id: "CRT-4123", commonName: "intranet.nexus.io", sans: ["intranet.nexus.io", "wiki.nexus.io"], issuer: "Internal CA", issuerType: "Internal CA", serial: "0x08:5A:79:C2:94:EC:1B:03:46:9F:27:E4:BD:5F:08", fingerprintSha256: fp(4123), signatureAlgorithm: "SHA256-ECDSA", keyType: "ECDSA", keySize: 256, issuedAt: ago(160), expiresAt: ahead(12), autoRenew: false, renewalMethod: "Manual", ownerId: "Marcus Lee", environment: "Production", hostIds: ["app-server-02"], service: "Wiki", port: 443, tags: ["wiki", "internal"], revoked: false },
  { id: "CRT-4124", commonName: "apps.nexus.io", sans: ["apps.nexus.io", "console.nexus.io", "admin.nexus.io"], issuer: "DigiCert", issuerType: "Public CA", serial: "0x0C:08:4F:66:A1:39:8B:2C:E5:B4:7D:01:F6:92:40", fingerprintSha256: fp(4124), signatureAlgorithm: "SHA256-RSA", keyType: "RSA", keySize: 2048, issuedAt: ago(80), expiresAt: ahead(40), autoRenew: true, renewalMethod: "Vendor", ownerId: "Sara Iqbal", environment: "Production", hostIds: ["app-server-02", "web-02"], service: "HTTPS", port: 443, tags: ["apps", "admin"], revoked: false },
  { id: "CRT-4125", commonName: "test.nexus.io", sans: ["test.nexus.io"], issuer: "Let's Encrypt", issuerType: "Public CA", serial: "0x0B:E1:95:08:72:4F:A6:D2:3C:88:1B:F0:05:6E:A9", fingerprintSha256: fp(4125), signatureAlgorithm: "SHA256-RSA", keyType: "RSA", keySize: 2048, issuedAt: ago(190), expiresAt: ahead(75), autoRenew: true, renewalMethod: "ACME", ownerId: "Tom Becker", environment: "Staging", hostIds: ["web-02"], service: "HTTPS", port: 443, tags: ["test", "staging"], revoked: false },
  { id: "CRT-4126", commonName: "ftp.nexus.io", sans: ["ftp.nexus.io"], issuer: "Sectigo", issuerType: "Public CA", serial: "0x0D:73:B8:45:0E:6F:C2:99:17:E0:84:A3:5C:2D:F6", fingerprintSha256: fp(4126), signatureAlgorithm: "SHA256-RSA", keyType: "RSA", keySize: 2048, issuedAt: ago(280), expiresAt: ahead(-60), autoRenew: false, renewalMethod: "Manual", ownerId: "Priya Nair", environment: "Production", hostIds: ["edge-01"], service: "FTPS", port: 21, tags: ["ftp", "legacy"], revoked: true },
  { id: "CRT-4127", commonName: "search.internal.nexus.io", sans: ["search.internal.nexus.io", "elastic.nexus.internal"], issuer: "Internal CA", issuerType: "Internal CA", serial: "0x07:F2:C6:3B:50:A7:D4:0E:39:98:B1:74:2A:16:85", fingerprintSha256: fp(4127), signatureAlgorithm: "SHA256-ECDSA", keyType: "ECDSA", keySize: 384, issuedAt: ago(55), expiresAt: ahead(128), autoRenew: true, renewalMethod: "ACME", ownerId: "Tom Becker", environment: "Production", hostIds: ["cache-01"], service: "Elasticsearch", port: 9200, tags: ["search", "internal"], revoked: false },
  { id: "CRT-4128", commonName: "billing.nexus.io", sans: ["billing.nexus.io"], issuer: "DigiCert", issuerType: "Public CA", serial: "0x09:1C:70:8A:E9:33:54:F5:B8:04:67:21:DC:3A:A0", fingerprintSha256: fp(4128), signatureAlgorithm: "SHA256-RSA", keyType: "RSA", keySize: 2048, issuedAt: ago(45), expiresAt: ahead(92), autoRenew: true, renewalMethod: "Vendor", ownerId: "Sara Iqbal", environment: "Production", hostIds: ["web-app-01"], service: "HTTPS/Payments", port: 443, tags: ["billing", "payments"], revoked: false },
  { id: "CRT-4129", commonName: "old-wiki.nexus.io", sans: ["old-wiki.nexus.io"], issuer: "Sectigo", issuerType: "Public CA", serial: "0x0E:94:26:17:C3:48:FA:70:E5:A1:5B:09:63:D8:2E", fingerprintSha256: fp(4129), signatureAlgorithm: "SHA256-RSA", keyType: "RSA", keySize: 2048, issuedAt: ago(320), expiresAt: ahead(38), autoRenew: false, renewalMethod: "Manual", ownerId: "Marcus Lee", environment: "Production", hostIds: ["app-server-02"], service: "HTTPS", port: 443, tags: ["wiki", "legacy"], revoked: false },
  { id: "CRT-4130", commonName: "vault.internal.nexus.io", sans: ["vault.internal.nexus.io"], issuer: "Internal CA", issuerType: "Internal CA", serial: "0x05:B9:D3:60:E7:11:4E:A8:CB:02:76:39:F9:1C:57", fingerprintSha256: fp(4130), signatureAlgorithm: "SHA256-ECDSA", keyType: "ECDSA", keySize: 384, issuedAt: ago(12), expiresAt: ahead(353), autoRenew: true, renewalMethod: "ACME", ownerId: "Priya Nair", environment: "Production", hostIds: ["auth-01"], service: "Vault", port: 8200, tags: ["secrets", "internal"], revoked: false },
  { id: "CRT-4131", commonName: "log.nexus.io", sans: ["log.nexus.io", "syslog.nexus.io"], issuer: "Internal CA", issuerType: "Internal CA", serial: "0x06:40:C8:1F:25:93:BB:67:49:E2:0A:78:4D:35:11", fingerprintSha256: fp(4131), signatureAlgorithm: "SHA256-ECDSA", keyType: "ECDSA", keySize: 256, issuedAt: ago(68), expiresAt: ahead(5), autoRenew: false, renewalMethod: "Manual", ownerId: "Tom Becker", environment: "Production", hostIds: ["worker-01"], service: "Syslog", port: 514, tags: ["logging", "internal"], revoked: false },
  { id: "CRT-4132", commonName: "cdn2.nexus.io", sans: ["cdn2.nexus.io", "img.nexus.io", "assets.nexus.io"], issuer: "Let's Encrypt", issuerType: "Public CA", serial: "0x08:E6:31:A9:8D:76:04:F2:9B:47:C1:58:B4:20:97", fingerprintSha256: fp(4132), signatureAlgorithm: "SHA256-RSA", keyType: "RSA", keySize: 2048, issuedAt: ago(142), expiresAt: ahead(22), autoRenew: true, renewalMethod: "ACME", ownerId: "Sara Iqbal", environment: "Production", hostIds: ["edge-01"], service: "CDN", port: 443, tags: ["cdn", "edge", "assets"], revoked: false },
];

export const CERTS: Certificate[] = SEEDS.map((seed) => {
  const chainValid = seed.chainValid ?? (seed.issuerType !== "Self-signed");
  const lastCheckedAt = agoHours(seed.lastCheckedHoursAgo ?? 2 + (Number(seed.id.slice(-2)) % 5));
  return {
    ...seed,
    chainValid,
    lastCheckedAt,
    status: expiryStatus(seed.expiresAt, seed.revoked),
  };
});

export const CERT_EVENTS: CertificateEvent[] = [
  { id: "CEVT-9021", certId: "CRT-4104", type: "expiring", at: agoHours(2), actor: "system", detail: "Certificate expires in 7 days — ACME renewal scheduled" },
  { id: "CEVT-9020", certId: "CRT-4105", type: "expiring", at: agoHours(6), actor: "system", detail: "Certificate expires in 3 days — auto-renew retried twice" },
  { id: "CEVT-9019", certId: "CRT-4114", type: "scan", at: agoHours(9), actor: "Ayesha Khan", detail: "Weak RSA-1024 key flagged by scanner" },
  { id: "CEVT-9018", certId: "CRT-4126", type: "revoked", at: ago(4), actor: "Priya Nair", detail: "Revoked: private key suspected compromised; CRL entry published" },
  { id: "CEVT-9017", certId: "CRT-4102", type: "renewed", at: ago(3), actor: "system", detail: "Wildcard certificate renewed via DigiCert (valid until 2027-05-11)" },
  { id: "CEVT-9016", certId: "CRT-4101", type: "deployed", at: ago(8), actor: "Ayesha Khan", detail: "Re-deployed to api-server-01 and api-server-02" },
  { id: "CEVT-9015", certId: "CRT-4131", type: "expiring", at: ago(1), actor: "system", detail: "Certificate expires in 5 days — manual renewal required (auto-renew off)" },
  { id: "CEVT-9014", certId: "CRT-4123", type: "alert", at: ago(1), actor: "system", detail: "Expiry alert sent: 12 days — channel Slack #security" },
];

export const EXPIRY_POLICIES: ExpiryAlertPolicy[] = [
  { id: "POL-01", name: "Default production policy", thresholds: [60, 30, 14, 7, 1], channels: ["Slack", "Email"], enabled: true, appliesTo: "Production" },
  { id: "POL-02", name: "Critical services — strict", thresholds: [90, 60, 30, 14, 7, 3, 1], channels: ["Slack", "Email", "PagerDuty"], enabled: true, appliesTo: "Production (auth, vpn, payments)" },
  { id: "POL-03", name: "Internal-only certificates", thresholds: [30, 7], channels: ["Email"], enabled: true, appliesTo: "Internal CA" },
  { id: "POL-04", name: "Staging & dev — relaxed", thresholds: [14, 7], channels: ["Slack"], enabled: false, appliesTo: "Staging/Development" },
];

interface CertStore {
  certs: Certificate[];
  events: CertificateEvent[];
  policies: ExpiryAlertPolicy[];
}
const store: CertStore = {
  certs: CERTS.map((cert) => ({ ...cert, sans: [...cert.sans], hostIds: [...cert.hostIds], tags: [...cert.tags] })),
  events: CERT_EVENTS.map((event) => ({ ...event })),
  policies: EXPIRY_POLICIES.map((policy) => ({ ...policy, thresholds: [...policy.thresholds], channels: [...policy.channels] })),
};

export interface CertSummary {
  total: number;
  expired: number;
  expiring30: number;
  autoRenewCoveragePct: number;
  weak: number;
  avgHealthScore: number;
  expiring7: number;
  selfSigned: number;
  critical: number;
  healthy: number;
  revoked: number;
}

export function computeCertSummary(nowMs = Date.now()): CertSummary {
  const autoRenew = store.certs.filter((cert) => cert.autoRenew).length;
  const weak = store.certs.filter((cert) => /sha1/i.test(cert.signatureAlgorithm) || cert.keySize < 2048).length;
  const statuses = store.certs.map((cert) => expiryStatus(cert.expiresAt, cert.revoked, nowMs));
  const scores = store.certs.map((cert) => healthScore({ daysLeft: daysUntilExpiry(cert.expiresAt, nowMs), signatureAlgorithm: cert.signatureAlgorithm, keySize: cert.keySize, chainValid: cert.chainValid, autoRenew: cert.autoRenew, revoked: cert.revoked }));
  const avgHealthScore = scores.length ? Math.round(scores.reduce((acc, value) => acc + value, 0) / scores.length) : 0;
  return {
    total: store.certs.length,
    expired: statuses.filter((s) => s === "Expired").length,
    expiring30: statuses.filter((s) => s === "Critical" || s === "Expiring soon").length,
    autoRenewCoveragePct: Math.round((autoRenew / store.certs.length) * 100),
    weak,
    avgHealthScore,
    expiring7: statuses.filter((s) => s === "Critical").length,
    selfSigned: store.certs.filter((cert) => cert.issuerType === "Self-signed").length,
    critical: statuses.filter((s) => s === "Critical").length,
    healthy: statuses.filter((s) => s === "Healthy").length,
    revoked: store.certs.filter((cert) => cert.revoked).length,
  };
}

const delay = () => 200 + Math.random() * 200;

export async function loadCertificates(): Promise<Certificate[]> {
  await new Promise((resolve) => setTimeout(resolve, delay()));
  return store.certs.map((cert) => ({ ...cert, sans: [...cert.sans], hostIds: [...cert.hostIds], tags: [...cert.tags], status: expiryStatus(cert.expiresAt, cert.revoked) }));
}

export async function loadCertificateEvents(): Promise<CertificateEvent[]> {
  await new Promise((resolve) => setTimeout(resolve, delay()));
  return store.events.map((event) => ({ ...event }));
}

export async function loadExpiryPolicies(): Promise<ExpiryAlertPolicy[]> {
  await new Promise((resolve) => setTimeout(resolve, delay()));
  return store.policies.map((policy) => ({ ...policy, thresholds: [...policy.thresholds], channels: [...policy.channels] }));
}

export function getCertSummary(): CertSummary {
  return computeCertSummary();
}

export function getCertificateById(id: string): Certificate | undefined {
  const cert = store.certs.find((item) => item.id === id);
  return cert ? { ...cert, sans: [...cert.sans], hostIds: [...cert.hostIds], tags: [...cert.tags], status: expiryStatus(cert.expiresAt, cert.revoked) } : undefined;
}

export function getCertificateEvents(certId?: string): CertificateEvent[] {
  return store.events.filter((event) => !certId || event.certId === certId).map((event) => ({ ...event }));
}

const CURRENT_USER = "Ayesha Khan";

export function renewCertificate(id: string, opts: { method: CertRenewalMethod; years?: number }): void {
  const cert = store.certs.find((item) => item.id === id);
  if (!cert) return;
  const issued = new Date();
  const expires = new Date(issued.getTime() + (opts.years ?? 1) * 365 * 86_400_000);
  cert.issuedAt = issued.toISOString();
  cert.expiresAt = expires.toISOString();
  cert.status = "Healthy";
  cert.revoked = false;
  cert.autoRenew = opts.method !== "Manual";
  cert.lastCheckedAt = issued.toISOString();
  store.events.unshift({ id: `CEVT-${Date.now()}`, certId: id, type: "renewed", at: issued.toISOString(), actor: CURRENT_USER, detail: `Certificate renewed via ${opts.method}; valid until ${expires.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}` });
  logAudit({ actor: { id: "ACC-02", name: CURRENT_USER, type: "Human", role: "Operations" }, action: "Renewed certificate", category: "Security", resource: { type: "Certificate", id, name: cert.commonName }, result: "Success" });
}

export function revokeCertificate(id: string, reason: string): void {
  const cert = store.certs.find((item) => item.id === id);
  if (!cert) return;
  cert.revoked = true;
  cert.status = "Revoked";
  cert.lastCheckedAt = new Date().toISOString();
  store.events.unshift({ id: `CEVT-${Date.now()}`, certId: id, type: "revoked", at: cert.lastCheckedAt, actor: CURRENT_USER, detail: `Revoked: ${reason}` });
  logAudit({ actor: { id: "ACC-02", name: CURRENT_USER, type: "Human", role: "Operations" }, action: "Revoked certificate", category: "Security", resource: { type: "Certificate", id, name: cert.commonName }, result: "Success", reason });
}

export function setCertificateAutoRenew(id: string, enabled: boolean): void {
  const cert = store.certs.find((item) => item.id === id);
  if (!cert) return;
  cert.autoRenew = enabled;
  cert.lastCheckedAt = new Date().toISOString();
  store.events.unshift({ id: `CEVT-${Date.now()}`, certId: id, type: "deployed", at: cert.lastCheckedAt, actor: CURRENT_USER, detail: `Auto-renew ${enabled ? "enabled" : "disabled"}` });
  logAudit({ actor: { id: "ACC-02", name: CURRENT_USER, type: "Human", role: "Operations" }, action: enabled ? "Enabled auto-renew" : "Disabled auto-renew", category: "Security", resource: { type: "Certificate", id, name: cert.commonName }, result: "Success" });
}

export function assignCertificateOwner(id: string, ownerId: string): void {
  const cert = store.certs.find((item) => item.id === id);
  if (!cert) return;
  cert.ownerId = ownerId;
  cert.lastCheckedAt = new Date().toISOString();
  logAudit({ actor: { id: "ACC-02", name: CURRENT_USER, type: "Human", role: "Operations" }, action: "Assigned certificate", category: "Security", resource: { type: "Certificate", id, name: cert.commonName }, result: "Success", reason: `Owner set to ${ownerId}` });
}

export function markCertificateVerified(id: string): void {
  const cert = store.certs.find((item) => item.id === id);
  if (!cert) return;
  cert.lastCheckedAt = new Date().toISOString();
  store.events.unshift({ id: `CEVT-${Date.now()}`, certId: id, type: "scan", at: cert.lastCheckedAt, actor: CURRENT_USER, detail: "Deployment verified: TLS handshake OK, chain valid, hostname match" });
}

/** Mock scan: marks two long-expiring certs as deployed and adds a scan event; returns updated certs. */
export function scanCertificates(scope: { label: string }): Certificate[] {
  const nowIso = new Date().toISOString();
  store.events.unshift({ id: `CEVT-${Date.now()}-scan`, certId: "CRT-4101", type: "scan", at: nowIso, actor: CURRENT_USER, detail: `Scan completed - scope: ${scope.label}. No new findings.` });
  logAudit({ actor: { id: "ACC-02", name: CURRENT_USER, type: "Human", role: "Operations" }, action: "Scanned certificates", category: "Security", resource: { type: "Certificate", id: "bulk", name: scope.label }, result: "Success" });
  return store.certs.map((cert) => ({ ...cert, sans: [...cert.sans], hostIds: [...cert.hostIds], tags: [...cert.tags], status: expiryStatus(cert.expiresAt, cert.revoked) }));
}
