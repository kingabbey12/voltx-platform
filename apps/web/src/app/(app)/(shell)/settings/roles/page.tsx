"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Lock, MoreHorizontal, Pencil, Plus, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useCreateRole,
  useDeleteRole,
  usePermissionCatalog,
  useRoles,
  useUpdateRole,
} from "@/hooks/use-invitations";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import type { Role } from "@/lib/api/invitations";

const roleFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.string().trim().max(500).optional(),
  permissionKeys: z.array(z.string()).min(1, "Select at least one permission"),
});
type RoleFormValues = z.infer<typeof roleFormSchema>;

export default function RolesSettingsPage() {
  const { data: roles, isLoading } = useRoles();
  const { data: permissions } = usePermissionCatalog();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  const permissionsByResource = useMemo(() => {
    const groups = new Map<string, typeof permissions>();
    for (const permission of permissions ?? []) {
      const list = groups.get(permission.resource) ?? [];
      list.push(permission);
      groups.set(permission.resource, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [permissions]);

  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: { name: "", description: "", permissionKeys: [] },
  });

  function openCreateDialog() {
    setEditingRole(null);
    form.reset({ name: "", description: "", permissionKeys: [] });
    setDialogOpen(true);
  }

  function openEditDialog(role: Role) {
    setEditingRole(role);
    form.reset({
      name: role.name,
      description: role.description ?? "",
      permissionKeys: role.permissions,
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: RoleFormValues) {
    try {
      if (editingRole) {
        await updateRole.mutateAsync({ id: editingRole.id, input: values });
        toast.success("Role updated");
      } else {
        await createRole.mutateAsync(values);
        toast.success("Role created");
      }
      setDialogOpen(false);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handleDelete(role: Role) {
    try {
      await deleteRole.mutateAsync(role.id);
      toast.success("Role deleted");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  const isSaving = createRole.isPending || updateRole.isPending;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium">Roles</h2>
          <p className="text-xs text-muted-foreground">
            System roles are shared and can&apos;t be changed. Create custom roles to grant exactly
            the permissions your team needs.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4" />
          New role
        </Button>
      </div>

      <div className="mt-4 rounded-xl border border-border">
        {isLoading && (
          <div className="flex flex-col gap-2 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-secondary/60" />
            ))}
          </div>
        )}

        {!isLoading && roles?.items.length === 0 && (
          <EmptyState icon={Shield} title="No roles found" description="Something went wrong loading roles." />
        )}

        {!isLoading && roles && roles.items.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.items.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {role.isSystem && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                      {role.name}
                    </div>
                    {role.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{role.description}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={role.isSystem ? "secondary" : "info"}>
                      {role.isSystem ? "System" : "Custom"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {role.permissions.length} permission{role.permissions.length === 1 ? "" : "s"}
                  </TableCell>
                  <TableCell>
                    {!role.isSystem && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More options">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(role)}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(role)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit role" : "Create a custom role"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="permissionKeys"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Permissions</FormLabel>
                    <div className="flex flex-col gap-2 rounded-lg border border-border p-2">
                      {permissionsByResource.map(([resource, resourcePermissions]) => (
                        <details key={resource} className="group">
                          <summary className="cursor-pointer list-none rounded-md px-2 py-1.5 text-sm font-medium capitalize hover:bg-secondary/60">
                            {resource.replace(/_/g, " ")}
                          </summary>
                          <div className="ml-2 mt-1 flex flex-col gap-1 border-l border-border pl-3">
                            {resourcePermissions?.map((permission) => {
                              const checked = field.value.includes(permission.key);
                              return (
                                <label
                                  key={permission.id}
                                  className="flex items-start gap-2 rounded-md px-2 py-1 text-sm hover:bg-secondary/40"
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-0.5 h-3.5 w-3.5 rounded border-border"
                                    checked={checked}
                                    onChange={(event) => {
                                      field.onChange(
                                        event.target.checked
                                          ? [...field.value, permission.key]
                                          : field.value.filter((key) => key !== permission.key),
                                      );
                                    }}
                                  />
                                  <span>
                                    <span className="font-medium">{permission.action}</span>
                                    {permission.description && (
                                      <span className="text-muted-foreground"> — {permission.description}</span>
                                    )}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </details>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={isSaving}>
                  {editingRole ? "Save changes" : "Create role"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
