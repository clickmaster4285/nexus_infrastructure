import Link from "next/link";
import { ArrowLeft, Hammer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageMeta } from "@/components/layout/page-meta";

interface ComingSoonProps {
  /** Section name shown as the page title, e.g. "Alerts". */
  title: string;
  /** Short description of what the page will provide. */
  description: string;
  /** Breadcrumb trail, e.g. ["Operations", "Alerts"]. */
  breadcrumbs: string[];
}

/** Professional placeholder for routes whose content has not been built yet. */
export function ComingSoon({ title, description, breadcrumbs }: ComingSoonProps) {
  return (
    <>
      <PageMeta breadcrumbs={breadcrumbs} showRefresh={false} />
      <Card className="mt-3 flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
          <Hammer size={22} aria-hidden="true" />
        </span>
        <h1 className="font-display text-xl font-extrabold tracking-tight">{title}</h1>
        <p className="max-w-md text-[11px] leading-relaxed text-muted-foreground">
          {description} This section is under construction — the route is wired up and ready for implementation.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-1">
          <Link href="/executive-overview">
            <ArrowLeft size={14} aria-hidden="true" />
            Back to Executive Overview
          </Link>
        </Button>
      </Card>
    </>
  );
}
