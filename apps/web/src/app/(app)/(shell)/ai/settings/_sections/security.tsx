"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Plus,
  Trash2,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import {
  useAiCredentials,
} from "@/hooks/use-ai-settings";
import { useAiSettings, useUpdateAiSettings } from "@/hooks/use-ai-settings";
import { friendlyErrorMessage } from "@/lib/api/api-error";

const schema = z.object({
  encryptCredentials: z.boolean().optional(),
  autoRotateDays: z.string().optional(),
  auditLogEnabled: z.boolean().optional(),
});

type Values = z.infer<typeof schema>;

export function SecuritySection() {
  const { data: settings, isLoading } = useAiSettings();
  const update = useUpdateAiSettings();
  const { data: creds } = useAiCredentials();

  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [newRole, setNewRole] = useState("");

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      encryptCredentials: true,
      autoRotateDays: "",
      auditLogEnabled: true,
    },
  });

  useEffect(() => {
    if (!settings?.security) return;
    form.reset({
      encryptCredentials: settings.security.encryptCredentials ?? true,
      autoRotateDays:
        settings.security.autoRotateDays?.toString() ?? "",
      auditLogEnabled: settings.security.auditLogEnabled ?? true,
    });
    setSelectedRoles(settings.security.restrictToRoles ?? []);
  }, [settings, form]);

  async function onSubmit(values: Values) {
    try {
      await update.mutateAsync({
        security: {
          encryptCredentials: values.encryptCredentials || undefined,
          autoRotateDays: values.autoRotateDays
            ? parseInt(values.autoRotateDays, 10)
            : undefined,
          auditLogEnabled: values.auditLogEnabled || undefined,
          restrictToRoles:
            selectedRoles.length > 0 ? selectedRoles : undefined,
        },
      });
      toast.success("Security settings updated");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  function addRole() {
    const role = newRole.trim();
    if (!role) return;
    if (selectedRoles.includes(role)) return;
    setSelectedRoles((prev) => [...prev, role]);
    setNewRole("");
  }

  function removeRole(role: string) {
    setSelectedRoles((prev) => prev.filter((r) => r !== role));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Security</h2>
        <p className="text-sm text-muted-foreground">
          Encrypted credentials, access control, and audit.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-4"
            >
              <FormField
                control={form.control}
                name="encryptCredentials"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-3">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <div>
                        <FormLabel className="!mt-0">
                          Encrypt credentials at rest
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          API keys are always encrypted. Disabling is not
                          recommended.
                        </p>
                      </div>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="auditLogEnabled"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-3">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <div>
                        <FormLabel className="!mt-0">
                          Audit log
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Record all AI configuration changes.
                        </p>
                      </div>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="autoRotateDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Auto-rotate API keys (days)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="90"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Set to 0 to disable auto-rotation.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Access control */}
              <div className="space-y-2 pt-2">
                <FormLabel>Restrict AI management to roles</FormLabel>
                <p className="text-xs text-muted-foreground">
                  Leave empty to allow all admins.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedRoles.map((role) => (
                    <Badge key={role} variant="secondary" className="gap-1">
                      <UserCheck className="h-3 w-3" />
                      {role}
                      <button
                        type="button"
                        onClick={() => removeRole(role)}
                        className="ml-0.5 hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    placeholder="admin"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addRole();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addRole}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>
              </div>

              <div className="pt-2">
                <Button type="submit" isLoading={update.isPending}>
                  Save security settings
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Credentials overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Credentials overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">
                Total credentials
              </p>
              <p className="text-lg font-semibold">
                {creds?.items.length ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Active</p>
              <p className="text-lg font-semibold text-emerald-500">
                {creds?.items.filter((c) => c.status === "ACTIVE").length ??
                  "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Disabled</p>
              <p className="text-lg font-semibold text-muted-foreground">
                {creds?.items.filter((c) => c.status === "DISABLED")
                  .length ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Providers configured
              </p>
              <p className="text-lg font-semibold">
                {creds
                  ? new Set(creds.items.map((c) => c.provider)).size
                  : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
