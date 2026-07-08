"use client";

import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useMyOrganizations, useSwitchOrganization } from "@/hooks/use-organizations";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { cn } from "@/lib/utils";

export function OrgSwitcher({ collapsed }: { collapsed: boolean }) {
  const user = useAuthStore((state) => state.user);
  const { data: organizations } = useMyOrganizations();
  const switchOrganization = useSwitchOrganization();

  const current = organizations?.find((org) => org.organizationId === user?.organizationId);

  async function handleSwitch(organizationId: string) {
    if (organizationId === user?.organizationId) return;
    try {
      await switchOrganization.mutateAsync(organizationId);
      toast.success("Switched organization");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-foreground/5 px-2.5 py-2 text-left text-sm transition-colors hover:bg-sidebar-foreground/10",
            collapsed && "justify-center px-0",
          )}
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary/25 to-accent/25 text-primary">
            <Building2 className="h-3.5 w-3.5" />
          </div>
          {!collapsed && (
            <>
              <span className="flex-1 truncate font-medium text-sidebar-foreground">
                {current?.organizationName ?? "Loading..."}
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        {organizations?.map((org) => (
          <DropdownMenuItem
            key={org.organizationId}
            onClick={() => handleSwitch(org.organizationId)}
            className="justify-between"
          >
            <span className="truncate">{org.organizationName}</span>
            {org.organizationId === user?.organizationId && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="text-muted-foreground">
          <Plus className="h-4 w-4" />
          Create organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
