"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Mail, MoreHorizontal, RefreshCw, UserPlus, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCreateInvitation, useInvitations, useResendInvitation, useRevokeInvitation, useRoles } from "@/hooks/use-invitations";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { formatDate } from "@/lib/format";
import type { InvitationStatus } from "@/lib/api/invitations";

const inviteSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  roleId: z.string().min(1, "Select a role"),
});
type InviteFormValues = z.infer<typeof inviteSchema>;

const STATUS_VARIANT: Record<InvitationStatus, "secondary" | "success" | "outline" | "destructive"> = {
  PENDING: "secondary",
  ACCEPTED: "success",
  EXPIRED: "outline",
  REVOKED: "destructive",
};

export default function TeamSettingsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: invitations, isLoading } = useInvitations();
  const { data: roles } = useRoles();
  const createInvitation = useCreateInvitation();
  const resendInvitation = useResendInvitation();
  const revokeInvitation = useRevokeInvitation();

  const invitableRoles = roles?.items.filter((role) => role.key !== "owner") ?? [];

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", roleId: "" },
  });

  async function onSubmit(values: InviteFormValues) {
    try {
      await createInvitation.mutateAsync(values);
      toast.success("Invitation sent");
      setDialogOpen(false);
      form.reset();
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium">Team members</h2>
          <p className="text-xs text-muted-foreground">Invite teammates and manage pending invitations.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Invite
        </Button>
      </div>

      <div className="mt-4 rounded-xl border border-border">
        {isLoading && (
          <div className="flex flex-col gap-2 p-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-secondary/60" />
            ))}
          </div>
        )}

        {!isLoading && invitations?.items.length === 0 && (
          <EmptyState icon={Users} title="No invitations yet" description="Invite teammates to collaborate." />
        )}

        {!isLoading && invitations && invitations.items.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.items.map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell className="flex items-center gap-2 font-medium">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    {invitation.email}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[invitation.status]}>{invitation.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(invitation.expiresAt)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More options">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={async () => {
                            try {
                              await resendInvitation.mutateAsync(invitation.id);
                              toast.success("Invitation resent");
                            } catch (error) {
                              toast.error(friendlyErrorMessage(error));
                            }
                          }}
                        >
                          <RefreshCw className="h-4 w-4" />
                          Resend
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={async () => {
                            try {
                              await revokeInvitation.mutateAsync(invitation.id);
                              toast.success("Invitation revoked");
                            } catch (error) {
                              toast.error(friendlyErrorMessage(error));
                            }
                          }}
                        >
                          <XCircle className="h-4 w-4" />
                          Revoke
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a teammate</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="roleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {invitableRoles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={createInvitation.isPending}>
                  Send invitation
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
