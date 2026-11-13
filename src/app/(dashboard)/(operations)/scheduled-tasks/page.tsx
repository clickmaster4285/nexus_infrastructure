import type { Metadata } from "next";

import { TasksDashboard } from "@/components/scheduled-tasks/tasks-dashboard";

export const metadata: Metadata = {
  title: "Scheduled Tasks",
};

export default function ScheduledTasksPage() {
  return <TasksDashboard />;
}
