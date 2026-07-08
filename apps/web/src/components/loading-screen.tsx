import { Loader2 } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

export function LoadingScreen() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background">
      <BrandMark />
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}
