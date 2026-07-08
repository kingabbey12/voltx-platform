"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CopilotButton } from "@/components/ai/copilot-button";
import {
  useOrganizationProfile,
  useUpdateBusinessInfo,
} from "@/hooks/use-onboarding";
import {
  businessInfoSchema,
  INDUSTRY_OPTIONS,
  type BusinessInfoFormValues,
} from "@/lib/validations/onboarding";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { useAuthStore } from "@/lib/stores/auth-store";
import { pushChunked } from "@/lib/ai/context-engine";

export default function GeneralSettingsPage() {
  const { data: organization, isLoading } = useOrganizationProfile();
  const updateBusinessInfo = useUpdateBusinessInfo();
  const user = useAuthStore((state) => state.user);

  const form = useForm<BusinessInfoFormValues>({
    resolver: zodResolver(businessInfoSchema),
    defaultValues: { name: "", industry: undefined, country: "" },
  });

  useEffect(() => {
    if (!organization) return;
    form.reset({
      name: organization.name,
      industry: organization.industry ?? undefined,
      country: organization.country ?? "",
    });
  }, [organization, form]);

  async function onSubmit(values: BusinessInfoFormValues) {
    try {
      await updateBusinessInfo.mutateAsync({
        name: values.name,
        industry: values.industry,
        country: values.country || undefined,
      });
      toast.success("Organization updated");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization</CardTitle>
          <CardDescription>
            Update your organization&apos;s profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization name</FormLabel>
                    <FormControl>
                      <Input disabled={isLoading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industry</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an industry" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {INDUSTRY_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                      <Input disabled={isLoading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div>
                <Button
                  type="submit"
                  isLoading={updateBusinessInfo.isPending}
                  disabled={isLoading}
                >
                  Save changes
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your access</CardTitle>
          <CardDescription>
            What your role lets you do in this workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {user?.roles.map((role) => (
                <Badge key={role} variant="secondary">
                  {role}
                </Badge>
              ))}
              <span className="text-xs text-muted-foreground">
                {user?.permissions.length ?? 0} permissions granted
              </span>
            </div>
            {user && (
              <CopilotButton
                label="Explain my permissions"
                dialogTitle="What can you do here?"
                prompt="Explain in plain, friendly language what this user's role and permissions let them do and not do in the workspace. Group related permissions together rather than listing every raw key."
                context={(() => {
                  const context = [`Role(s): ${user.roles.join(", ") || "member"}`];
                  pushChunked(context, "Permission keys: ", user.permissions);
                  return context;
                })()}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
