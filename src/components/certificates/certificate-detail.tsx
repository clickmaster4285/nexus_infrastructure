"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, Bug, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Copy, FileDown, GitBranch,
  KeyRound, Link2, MoreVertical, RotateCcw, SearchX, Send, ShieldCheck, ShieldX, Microchip, Clock3,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { AlertMenu } from "@/components/alerts/alert-menu";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChartCard } from "@/components/logs/primitives";
import { BarMeter, ComplianceBar } from "@/components/vulnerability/vuln-shared";
import { CertStatusBadge, IssuerTypeBadge, HealthBar, DaysLeftBadge, HostChips } from "@/components/certificates/cert-shared";
import {
  AuthToast, useAuthToast, RenewCertificateDialog, RevokeCertificateDialog, AssignCertOwnerDialog, ToggleAutoRenewDialog, downloadPem,
} from "@/components/certificates/cert-actions";
import { cn } from "@/lib/utils";
import { timeAgo, fullTime, timeZoneLabel } from "@/components/auth-events/auth-shared";
import { daysUntilExpiry, expiryStatus, healthScore, formatValidity, type CertStatus } from "@/utils/certStats";
import { useCertificates, useCertificate, useCertSummary } from "@/mocks/useCertificates";
import { renewCertificate, revokeCertificate, setCertificateAutoRenew, assignCertificateOwner, markCertificateVerified } from "@/mocks/certificates";

interface CertificateDetailProps {
  certId: string;
}

export function CertificateDetail({ certId }: CertificateDetailProps) {
  const router = useRouter();
  const { certs, status, reload } = useCertificates();
  const { cert, events } = useCertificate(certId);
  const summary = useCertSummary();
  const [mounted, setMounted] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [autoRenewOpen, setAutoRenewOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([
    { id: "c1", author: "Sara Iqbal", at: new Date(Date.now() - 4 * 3_600_000).toISOString(), text: "ACME challenge passed for both hosts; redeploy queued for 02:30 window." },
    { id: "c2", author: "Tom Becker", at: new Date(Date.now() - 26 * 3_600_000).toISOString(), text: "Renewal dry-run OK. Waiting on change approval from security@nexus.io." },
  ]);
  const { toast, notify, dismiss } = useAuthToast();

  useEffect(() => setMounted(true), []);

  const ordered = useMemo(() => [...certs].sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt)), [certs]);
  const index = ordered.findIndex((item) => item.id === certId);
  const newer = index > 0 ? ordered[index - 1] : null;
  const older = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : null;

  if (status === "loading" && !certs.length) {
    return (
      <div className="space-y-4 pb-4" aria-busy="true">
        <div className="h-[6.875rem] animate-pulse rounded-xl bg-muted" />
        <div className="grid gap-4 xl:grid-cols-12"><div className="space-y-4 xl:col-span-8"><div className="h-56 animate-pulse rounded-xl bg-muted" /><div className="h-40 animate-pulse rounded-xl bg-muted" /><div className="h-44 animate-pulse rounded-xl bg-muted" /></div><div className="space-y-4 xl:col-span-4"><div className="h-44 animate-pulse rounded-xl bg-muted" /><div className="h-44 animate-pulse rounded-xl bg-muted" /></div></div>
      </div>
    );
  }

  if (!cert) {
    return (
      <div className="space-y-4 pb-4">
        <PageHeader breadcrumbs={["Security", "Certificates & Expiration", certId]} title="Certificate not found" subtitle="This certificate is not in the current inventory." />
        <Card className="grid min-h-[17.5rem] place-items-center rounded-xl p-6"><div className="text-center"><SearchX className="mx-auto text-muted-foreground" size={28} /><h2 className="mt-2 text-base font-semibold">No certificate matches “{certId}”</h2><Button className="mt-4" onClick={() => router.back()}><ArrowLeft size={15} />Back to certificates</Button></div></Card>
      </div>
    );
  }

  const daysLeft = daysUntilExpiry(cert.expiresAt);
  const certStatus = expiryStatus(cert.expiresAt, cert.revoked);
  const score = healthScore({ daysLeft, signatureAlgorithm: cert.signatureAlgorithm, keySize: cert.keySize, chainValid: cert.chainValid, autoRenew: cert.autoRenew, revoked: cert.revoked });
  const totalPct = Math.round(((Date.now() - Date.parse(cert.issuedAt)) / (Date.parse(cert.expiresAt) - Date.parse(cert.issuedAt))) * 100);
  const hostsPort = cert.hostIds.map((hostId) => ({ hostId, port: cert.port, service: cert.service, lastChecked: cert.lastCheckedAt, status: expiryStatus(cert.expiresAt, cert.revoked) }));
  const thresholdMarkers = [60, 30, 14, 7, 1];

  const addComment = () => {
    const text = comment.trim();
    if (!text) return;
    setComments((current) => [{ id: `c${Date.now()}`, author: "Ayesha Khan", at: new Date().toISOString(), text }, ...current]);
    setComment("");
    notify({ message: "Comment posted" });
  };

  return (
    <div className="min-w-0 space-y-4 pb-4">
      <PageHeader
        breadcrumbs={["Security", "Certificates & Expiration", cert.commonName]}
        title={cert.commonName}
        subtitle={`${cert.id} · ${cert.issuer} · issued ${new Date(cert.issuedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}`}
        lastUpdated={mounted ? new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "…"}
        onRefresh={reload}
        statusBadge={<span className="flex flex-wrap items-center gap-1.5"><CertStatusBadge status={certStatus} /><IssuerTypeBadge type={cert.issuerType} /><DaysLeftBadge daysLeft={daysLeft} revoked={cert.revoked} /></span>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="h-10 gap-1.5 text-sm" onClick={() => router.back()}><ArrowLeft size={15} />Back</Button>
            <Button className="h-10 gap-1.5 text-sm" onClick={() => setRenewOpen(true)}><RotateCcw size={15} />Renew now</Button>
            <Button variant="outline" className="h-10 gap-1.5 text-sm" onClick={() => downloadPem(cert)}><FileDown size={15} />Download</Button>
            <AlertMenu
              label="More certificate actions"
              trigger={<Button variant="outline" className="h-10 w-10 px-0" aria-label="More actions"><MoreVertical size={16} /></Button>}
              items={[
                { key: "assign", label: "Assign owner", onSelect: () => setAssignOpen(true) },
                { key: "toggle", label: cert.autoRenew ? "Disable auto-renew" : "Enable auto-renew", onSelect: () => setAutoRenewOpen(true) },
                { key: "verify", label: "Verify deployment", onSelect: () => { markCertificateVerified(cert.id); notify({ message: "Handshake verified — chain OK on all hosts" }); } },
                { key: "fingerprint", label: "Copy fingerprint", onSelect: () => { try { void navigator.clipboard?.writeText(cert.fingerprintSha256); notify({ message: "Fingerprint copied" }); } catch { notify({ message: "Clipboard unavailable" }); } } },
                { key: "revoke", label: "Revoke certificate", danger: true, onSelect: () => setRevokeOpen(true) },
                { key: "copy", label: "Copy link", onSelect: () => { try { void navigator.clipboard?.writeText(window.location.href); notify({ message: "Link copied" }); } catch { notify({ message: "Clipboard unavailable" }); } } },
              ]}
            />
          </div>
        }
      />

      <div className="grid grid-cols-2 items-stretch gap-4 md:grid-cols-4">
        <MiniMetric label="Days Left" value={cert.revoked ? "—" : String(Math.max(0, daysLeft))} tone={daysLeft < 0 || cert.revoked ? "text-red-600" : daysLeft <= 7 ? "text-orange-600" : daysLeft <= 30 ? "text-amber-700" : "text-foreground"} />
        <MiniMetric label="Validity" value={formatValidity(cert.issuedAt, cert.expiresAt)} tone="text-foreground" />
        <MiniMetric label="Health Score" value={String(score)} tone={score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-700" : "text-red-600"} />
        <MiniMetric label="Auto-Renew" valueNode={cert.autoRenew ? <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400"><CheckCircle2 size={16} aria-hidden="true" />Enabled</span> : <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400"><AlertTriangle size={16} aria-hidden="true" />Manual</span>} tone="text-foreground" />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-12">
        {/* LEFT */}
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-8">
          <Card className="flex flex-col rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground">Overview</h2>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 text-[0.8125rem] sm:grid-cols-2">
              <Field label="Common name" value={<span className="break-all font-mono">{cert.commonName}</span>} />
              <Field label="Issuer" value={<span className="flex items-center gap-2">{cert.issuer}<IssuerTypeBadge type={cert.issuerType} /></span>} />
              <Field label="SANs" value={<span className="break-all">{cert.sans.join(", ")}</span>} />
              <Field label="Serial" value={<span className="break-all font-mono text-xs">{cert.serial}</span>} />
              <Field label="Signature algorithm" value={<span className="font-mono text-xs">{cert.signatureAlgorithm}</span>} />
              <Field label="Public key" value={`${cert.keyType} ${cert.keySize}`} />
              <Field label="Issued" value={new Date(cert.issuedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })} />
              <Field label="Expires" value={<span>{new Date(cert.expiresAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}<span className="ml-2 text-xs text-muted-foreground">({daysLeft}d)</span></span>} />
              <Field label="Service" value={`${cert.service} · port ${cert.port}`} />
              <Field label="Environment" value={cert.environment} />
              <Field label="Renewal method" value={cert.renewalMethod} />
              <Field label="Hosts" valueNode={<HostChips hosts={cert.hostIds} max={4} />} />
            </dl>
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3">
              <span className="min-w-0 flex-1 truncate font-mono text-[0.6875rem] text-muted-foreground" title={cert.fingerprintSha256}>{cert.fingerprintSha256}</span>
              <button type="button" onClick={() => { try { void navigator.clipboard?.writeText(cert.fingerprintSha256); notify({ message: "Fingerprint copied" }); } catch { notify({ message: "Clipboard unavailable" }); } }} aria-label="Copy fingerprint" className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"><Copy size={14} /></button>
            </div>
          </Card>

          <ChartCard title="Validity timeline" actions={<span className="text-xs text-muted-foreground">{new Date(cert.issuedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })} → {new Date(cert.expiresAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</span>}>
            <div className="relative h-14 w-full overflow-hidden rounded-lg bg-muted">
              {thresholdMarkers.map((threshold) => {
                const iso = threshold === 1 ? 1 : Math.max(1, Math.round((Date.parse(cert.expiresAt) - Date.now()) / 86_400_000));
                const pos = threshold === 60 ? 0 : threshold === 30 ? 33 : threshold === 14 ? 66 : threshold === 7 ? 83 : 96;
                return <span key={threshold} className="absolute inset-y-0 border-l border-dashed border-amber-400" style={{ left: `${pos}%` }} aria-hidden="true" />;
              })}
              <div className="absolute inset-y-0 left-0 rounded-l-lg bg-emerald-500/30" style={{ width: `${Math.min(100, totalPct)}%` }} />
              <div className="absolute inset-y-0 w-[0.1875rem] bg-slate-900 dark:bg-slate-100" style={{ left: `calc(${Math.min(100, totalPct)}% - 0.0625rem)` }} aria-hidden="true" />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-[0.6875rem] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-500" />Issued</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-amber-500" />Alert thresholds (60/30/14/7/1d)</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-slate-700 dark:bg-slate-200" />Today</span>
            </div>
          </ChartCard>

          <ChartCard title="Certificate chain" actions={<span className="text-xs text-muted-foreground">{cert.issuerType === "Self-signed" ? "Self-signed — no chain" : "3 nodes"}</span>}>
            <ol className="flex flex-col gap-2 text-[0.8125rem]">
              {[
                { node: "Leaf", name: cert.commonName, status: certStatus, tone: "emerald" as const },
                { node: "Intermediate", name: cert.issuerType === "Self-signed" ? "—" : `${cert.issuer} intermediate`, status: cert.chainValid ? "Valid" : "Invalid", tone: cert.chainValid ? "emerald" as const : "rose" as const },
                { node: "Root", name: cert.issuerType === "Self-signed" ? "—" : cert.issuer === "Internal CA" ? "Nexus Internal Root CA" : `${cert.issuer} Root`, status: "Valid", tone: "emerald" as const },
              ].map((row) => (
                <li key={row.node} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                  <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-[0.6875rem] font-bold", row.tone === "emerald" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>{row.node === "Leaf" ? "L" : row.node === "Intermediate" ? "I" : "R"}</span>
                  <span className="min-w-0 flex-1"><span className="block text-[0.6875rem] uppercase tracking-wide text-muted-foreground">{row.node}</span><span className="block truncate font-medium text-foreground" title={row.name}>{row.name}</span></span>
                  <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[0.6875rem] font-semibold", row.status === "Valid" || row.status === "Healthy" ? "bg-emerald-100 text-emerald-700" : row.status === "Expired" || row.status === "Invalid" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800")}>{row.status}</span>
                </li>
              ))}
            </ol>
          </ChartCard>

          <ChartCard title="Deployed on" actions={<span className="text-xs text-muted-foreground">{hostsPort.length} host{hostsPort.length === 1 ? "" : "s"}</span>}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[30rem] text-left text-[0.8125rem]">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-2 py-2 font-semibold">Host</th><th className="px-2 py-2 font-semibold">Service</th><th className="px-2 py-2 font-semibold">Port</th><th className="px-2 py-2 font-semibold">Last checked</th><th className="px-2 py-2 text-right font-semibold"><span className="sr-only">Action</span></th></tr></thead>
                <tbody>
                  {hostsPort.map((host) => (
                    <tr key={host.hostId} className="border-b border-border/70 hover:bg-muted/30">
                      <td className="px-2 py-2 font-mono font-semibold"><Link href={`/server-details/${encodeURIComponent(host.hostId)}`} className="text-primary hover:underline">{host.hostId}</Link></td>
                      <td className="px-2 py-2 text-muted-foreground">{host.service}</td>
                      <td className="px-2 py-2 tabular-nums text-muted-foreground">{host.port}</td>
                      <td className="px-2 py-2 whitespace-nowrap text-muted-foreground">{mounted ? timeAgo(host.lastChecked) : "…"}</td>
                      <td className="px-2 py-2 text-right"><Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { markCertificateVerified(cert.id); notify({ message: `${host.hostId} — handshake verified, chain OK` }); }}>Verify</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </div>

        {/* RIGHT */}
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-4">
          <Card className="flex flex-col rounded-xl p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><ShieldCheck size={15} aria-hidden="true" />Health checks</h2>
            <ul className="mt-3 flex flex-col divide-y divide-border text-[0.8125rem]">
              {healthChecks(cert).map((check) => (
                <li key={check.name} className="flex items-start gap-2.5 py-2">
                  <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full", check.pass ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300")}>{check.pass ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}</span>
                  <span className="min-w-0 flex-1"><span className="block font-semibold text-foreground">{check.name}</span><span className="mt-0.5 block text-[0.6875rem] text-muted-foreground">{check.detail}</span></span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="flex flex-col rounded-xl p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Clock3 size={15} aria-hidden="true" />Expiry alerts</h2>
              <button type="button" onClick={() => notify({ message: "Policy editor opened (mock)" })} className="text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Edit policy</button>
            </div>
            <p className="mt-2 text-[0.6875rem] text-muted-foreground">Thresholds (days before expiry) · channels</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[60, 30, 14, 7, 1].map((threshold) => <span key={threshold} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[0.6875rem] font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">{threshold}d</span>)}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">{["Email", "Slack", "PagerDuty"].map((channel) => <span key={channel} className="rounded-md border border-border bg-muted/40 px-2 py-1 text-[0.6875rem] font-medium text-muted-foreground">{channel}</span>)}</div>
            <p className="mt-3 border-t border-border pt-3 text-[0.6875rem] text-muted-foreground">Policy: <b className="text-foreground">Default production policy</b> · applies to all certs in this scope</p>
          </Card>

          <Card className="flex flex-col rounded-xl p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><GitBranch size={15} aria-hidden="true" />Timeline</h2>
            <ol className="mt-2 flex flex-col divide-y divide-border">
              {events.slice(0, 6).map((event) => (
                <li key={event.id} className="flex items-start gap-2 py-2 text-[0.8125rem]">
                  <span className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.625rem]", event.type === "renewed" || event.type === "deployed" ? "bg-emerald-100 text-emerald-700" : event.type === "revoked" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700")}>{event.type === "renewed" ? <CheckCircle2 size={11} /> : event.type === "revoked" ? <AlertTriangle size={11} /> : <Clock3 size={11} />}</span>
                  <span className="min-w-0 flex-1"><span className="block font-semibold text-foreground">{event.actor}</span><span className="mt-0.5 block text-[0.6875rem] text-muted-foreground">{event.detail}</span><span className="mt-0.5 block text-[0.625rem] text-muted-foreground">{mounted ? timeAgo(event.at) : "…"}</span></span>
                </li>
              ))}
              {events.length === 0 && <li className="py-3 text-center text-xs text-muted-foreground">No events yet.</li>}
            </ol>
            <form onSubmit={(event) => { event.preventDefault(); addComment(); }} className="mt-3 flex items-center gap-2 border-t border-border pt-3">
              <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a note…" aria-label="Add a note" className="h-9 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
              <Button type="submit" variant="outline" size="sm" className="h-9 gap-1.5" aria-label="Post note" disabled={comment.trim().length === 0}><Send size={13} /></Button>
            </form>
          </Card>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        {newer ? <Button variant="outline" className="h-10 gap-1.5 text-sm" onClick={() => router.push(`/certificates-and-expiration/${newer.id}`)}><ChevronLeft size={15} />Newer · {newer.id}</Button> : <span />}
        <span className="text-xs text-muted-foreground">{index >= 0 ? `${index + 1} of ${ordered.length}` : ""}</span>
        {older ? <Button variant="outline" className="h-10 gap-1.5 text-sm" onClick={() => router.push(`/certificates-and-expiration/${older.id}`)}>{older.id} · Older<ChevronRight size={15} /></Button> : <span />}
      </div>

      <RenewCertificateDialog open={renewOpen} onOpenChange={setRenewOpen} certId={cert.id} onDone={(result) => { notify(result); reload(); }} />
      <RevokeCertificateDialog open={revokeOpen} onOpenChange={setRevokeOpen} certId={cert.id} onDone={(result) => { notify(result); reload(); }} />
      <AssignCertOwnerDialog open={assignOpen} onOpenChange={setAssignOpen} certId={cert.id} onDone={(result) => { notify(result); reload(); }} />
      <ToggleAutoRenewDialog open={autoRenewOpen} onOpenChange={setAutoRenewOpen} certId={cert.id} current={cert.autoRenew} onDone={(result) => { notify(result); reload(); }} />
      <AuthToast toast={toast} onDismiss={dismiss} />
    </div>
  );
}

function MiniMetric({ label, value, valueNode, tone }: { label: string; value?: string; valueNode?: React.ReactNode; tone?: string }) {
  return (
    <Card className="flex flex-col rounded-xl p-4">
      <p className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1.5 font-display text-2xl font-bold leading-none tabular-nums", tone ?? "text-foreground")}>{valueNode ?? value}</p>
    </Card>
  );
}

function Field({ label, value, valueNode }: { label: string; value?: React.ReactNode; valueNode?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 min-w-0 text-[0.8125rem] text-foreground">{valueNode ?? value}</dd>
    </div>
  );
}

function healthChecks(cert: { expiresAt: string; commonName: string; sans: string[]; chainValid: boolean; signatureAlgorithm: string; keySize: number; keyType: string; revoked: boolean; autoRenew: boolean }) {
  const days = daysUntilExpiry(cert.expiresAt);
  const weakSig = /sha1/i.test(cert.signatureAlgorithm);
  const weakKey = cert.keySize < 2048;
  const hostnameOk = cert.sans.includes(cert.commonName);
  return [
    { name: "Expiry", pass: days > 0, detail: days > 0 ? `${days} days remaining` : `Expired ${Math.abs(days)} days ago — renew now` },
    { name: "Hostname match", pass: hostnameOk, detail: hostnameOk ? "SAN matches the endpoint's hostname" : "SAN does NOT include the endpoint hostname" },
    { name: "Chain valid", pass: cert.chainValid, detail: cert.chainValid ? "Leaf → intermediate → root verified against system trust store" : "Certificate chain is broken or incomplete" },
    { name: "Strong signature", pass: !weakSig, detail: weakSig ? `${cert.signatureAlgorithm} is deprecated — re-issue with SHA-256` : `${cert.signatureAlgorithm} — OK` },
    { name: "Key size", pass: !weakKey, detail: weakKey ? `${cert.keySize}-bit ${cert.keyType} is too small — minimum 2048` : `${cert.keySize}-bit ${cert.keyType} — OK` },
    { name: "Revocation", pass: !cert.revoked, detail: cert.revoked ? "Revoked — clients must not trust this cert" : "Not revoked (CRL/OCSP clean)" },
    { name: "Auto-renew", pass: cert.autoRenew, detail: cert.autoRenew ? "Auto-renew configured — no action needed" : "Manual renewal required before expiry" },
  ];
}
