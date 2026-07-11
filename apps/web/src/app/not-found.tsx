import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <EmptyState
        icon={Compass}
        title="This page doesn't exist"
        description="The link may be broken, or the page may have moved."
        action={
          <Button asChild>
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        }
      />
    </div>
  );
}
