"use client";

import { useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
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
import { Combobox, type ComboboxGroup } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { CopilotButton } from "@/components/ai/copilot-button";
import {
  useOrganizationProfile,
  useUpdateBusinessInfo,
} from "@/hooks/use-onboarding";
import { useCountries, useIndustries } from "@/hooks/use-reference-data";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { useAuthStore } from "@/lib/stores/auth-store";
import { pushChunked } from "@/lib/ai/context-engine";

const organizationProfileSchema = z.object({
  name: z.string().trim().min(2, "Organization name must be at least 2 characters").max(255),
  industry: z.string().optional(),
  country: z.string().optional(),
});
type OrganizationProfileFormValues = z.infer<typeof organizationProfileSchema>;

export default function GeneralSettingsPage() {
  const { data: organization, isLoading } = useOrganizationProfile();
  const updateBusinessInfo = useUpdateBusinessInfo();
  const user = useAuthStore((state) => state.user);

  const { data: industryGroups } = useIndustries();
  const { data: countries } = useCountries();

  const industryOptions: ComboboxGroup[] = useMemo(
    () =>
      (industryGroups ?? []).map((group) => ({
        heading: group.category,
        options: group.items.map((item) => ({ value: item, label: item })),
      })),
    [industryGroups],
  );

  const countryOptions = useMemo(
    () =>
      (countries ?? []).map((c) => ({
        value: c.isoCode,
        label: `${c.flag} ${c.name}`,
        keywords: [c.isoCode, c.name],
      })),
    [countries],
  );

  const form = useForm<OrganizationProfileFormValues>({
    resolver: zodResolver(organizationProfileSchema),
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

  async function onSubmit(values: OrganizationProfileFormValues) {
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
                    <FormControl>
                      <Combobox
                        options={industryOptions}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select an industry"
                        searchPlaceholder="Search industries..."
                        disabled={isLoading}
                      />
                    </FormControl>
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
                      <Combobox
                        options={countryOptions}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select a country"
                        searchPlaceholder="Search countries..."
                        disabled={isLoading}
                      />
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
