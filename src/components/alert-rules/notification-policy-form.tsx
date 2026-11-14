"use client";

import { Mail, MessageSquare, Webhook, Zap } from "lucide-react";

import { NOTIFICATION_CHANNELS, type NotificationChannel, type NotificationPolicy } from "@/mocks/alertRules";
import { ToggleSwitch } from "@/components/alert-rules/toggle-switch";
import { cn } from "@/lib/utils";

const CHANNEL_META: Record<NotificationChannel, { icon: typeof Mail; label: string; hint: string }> = {
  Email: { icon: Mail, label: "Email", hint: "SMTP to recipients" },
  Slack: { icon: MessageSquare, label: "Slack", hint: "Posts to a channel" },
  PagerDuty: { icon: Zap, label: "PagerDuty", hint: "Pages the on-call" },
  Webhook: { icon: Webhook, label: "Webhook", hint: "POSTs a JSON payload" },
};

const ESCALATION_OPTIONS = [0, 5, 10, 15, 20, 30, 45, 60, 240];
const REPEAT_OPTIONS = ["10m", "15m", "30m", "1h", "4h", "6h", "24h", "7d"];

export interface NotificationPolicyErrors {
  channels?: string;
  recipients?: string;
}

interface NotificationPolicyFormProps {
  value: NotificationPolicy;
  errors?: NotificationPolicyErrors;
  onChange: (next: NotificationPolicy) => void;
}

const fieldClass =
  "h-9 w-full rounded-lg border border-input bg-card px-2.5 text-[0.8125rem] text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

function Field({ label, htmlFor, error, children }: { label: string; htmlFor?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <label htmlFor={htmlFor} className="text-[0.75rem] font-medium text-muted-foreground">{label}</label>
      {children}
      {error && <p role="alert" className="text-[0.6875rem] font-medium text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

/** Channel toggles + recipients + escalation policy. Props-driven, no internal state except recipient text. */
export function NotificationPolicyForm({ value, errors, onChange }: NotificationPolicyFormProps) {
  const toggleChannel = (channel: NotificationChannel) => {
    const channels = value.channels.includes(channel) ? value.channels.filter((item) => item !== channel) : [...value.channels, channel];
    onChange({ ...value, channels });
  };

  const recipientsText = value.recipients.join(", ");

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <span id="policy-channels-label" className="text-[0.75rem] font-medium text-muted-foreground">Channels</span>
        <div role="group" aria-labelledby="policy-channels-label" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {NOTIFICATION_CHANNELS.map((channel) => {
            const meta = CHANNEL_META[channel];
            const active = value.channels.includes(channel);
            return (
              <button
                key={channel}
                type="button"
                role="checkbox"
                aria-checked={active}
                onClick={() => toggleChannel(channel)}
                className={cn(
                  "flex h-[4rem] flex-col items-center justify-center gap-0.5 rounded-lg border px-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:bg-accent",
                )}
              >
                <meta.icon size={17} aria-hidden="true" />
                <span className="text-[0.75rem] font-semibold leading-tight">{meta.label}</span>
                <span className="text-[0.5625rem] leading-tight text-muted-foreground">{meta.hint}</span>
              </button>
            );
          })}
        </div>
        {errors?.channels && <p role="alert" className="text-[0.6875rem] font-medium text-red-600 dark:text-red-400">{errors.channels}</p>}
      </div>

      <Field label="Recipients (comma separated)" htmlFor="policy-recipients" error={errors?.recipients}>
        <input
          id="policy-recipients"
          type="text"
          value={recipientsText}
          placeholder="on-call@nexus.io, #sre-critical"
          onChange={(event) => onChange({ ...value, recipients: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })}
          className={fieldClass}
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Escalate if not acked within" htmlFor="policy-escalation">
          <select id="policy-escalation" value={String(value.escalationMinutes)} onChange={(event) => onChange({ ...value, escalationMinutes: Number(event.target.value) })} className={fieldClass}>
            {ESCALATION_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>{minutes === 0 ? "No escalation" : `${minutes} minutes`}</option>
            ))}
          </select>
        </Field>
        <Field label="Repeat interval" htmlFor="policy-repeat">
          <select id="policy-repeat" value={value.repeatInterval} onChange={(event) => onChange({ ...value, repeatInterval: event.target.value })} className={fieldClass}>
            {REPEAT_OPTIONS.map((interval) => (
              <option key={interval} value={interval}>every {interval}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 px-3 py-2.5">
        <span className="min-w-0">
          <span className="block text-[0.8125rem] font-medium text-foreground">Respect quiet hours</span>
          <span className="block text-[0.6875rem] text-muted-foreground">Maintenance windows suppress non-critical notifications.</span>
        </span>
        <ToggleSwitch size="sm" checked={value.respectQuietHours} onChange={(checked) => onChange({ ...value, respectQuietHours: checked })} label="Respect quiet hours" />
      </div>
    </div>
  );
}
