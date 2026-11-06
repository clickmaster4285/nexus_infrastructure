import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 text-center text-foreground">
      <div className="flex flex-col items-center gap-3">
        <p className="font-display text-5xl font-extrabold tracking-tight text-primary">404</p>
        <h1 className="font-display text-lg font-bold">Page not found</h1>
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          The page you are looking for doesn&apos;t exist or may have been moved.
        </p>
        <Button asChild size="sm" className="mt-1">
          <Link href="/executive-overview">Back to Executive Overview</Link>
        </Button>
      </div>
    </main>
  );
}
