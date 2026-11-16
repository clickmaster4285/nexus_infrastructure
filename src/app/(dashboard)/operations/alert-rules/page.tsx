import type { Metadata } from "next";

import { AlertRulesDashboard } from "@/components/alert-rules/alert-rules-dashboard";

export const metadata: Metadata = {
  title: "Alert Rules",
};

export default function AlertRulesPage() {
  return <AlertRulesDashboard />;
}
