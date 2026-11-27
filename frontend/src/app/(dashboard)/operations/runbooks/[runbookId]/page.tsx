import type { Metadata } from "next";

import { RunbookDetail } from "@/components/runbooks/runbook-detail";
import { RunbookEditor } from "@/components/runbooks/runbook-editor";
import { RunbookRunner } from "@/components/runbooks/runbook-runner";

export const metadata: Metadata = {
  title: "Runbooks",
};

interface RunbookPageProps {
  params: Promise<{ runbookId: string }>;
  searchParams: Promise<{ mode?: string; rule?: string; template?: string; title?: string }>;
}

export default async function RunbookPage({ params, searchParams }: RunbookPageProps) {
  const { runbookId } = await params;
  const { mode, rule, template, title } = await searchParams;
  if (runbookId === "new") {
    return <RunbookEditor mode="new" prefilledRuleId={rule} prefilledTemplate={template} initialTitle={title} />;
  }
  if (mode === "edit") return <RunbookEditor mode="edit" runbookId={runbookId} />;
  if (mode === "run") return <RunbookRunner runbookId={runbookId} />;
  return <RunbookDetail runbookId={runbookId} />;
}
