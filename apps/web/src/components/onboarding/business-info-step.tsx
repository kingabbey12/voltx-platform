"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrganizationProfile, useUpdateBusinessInfo } from "@/hooks/use-onboarding";
import { businessInfoSchema, INDUSTRY_OPTIONS, type BusinessInfoFormValues } from "@/lib/validations/onboarding";
import { friendlyErrorMessage } from "@/lib/api/api-error";

export function BusinessInfoStep({ onNext }: { onNext: () => void }) {
  const { data: organization, isLoading } = useOrganizationProfile();
  const updateBusinessInfo = useUpdateBusinessInfo();

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
      onNext();
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Tell us about your business</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        This helps Voltx tailor agents and workflows to your industry.
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 flex flex-col gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company name</FormLabel>
                <FormControl>
                  <Input placeholder="Acme Inc." disabled={isLoading} autoFocus {...field} />
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
                <FormLabel>Industry (optional)</FormLabel>
                <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
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
                <FormLabel>Country (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="US" disabled={isLoading} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            size="lg"
            className="mt-4 w-full"
            isLoading={updateBusinessInfo.isPending}
            disabled={isLoading}
          >
            Continue
          </Button>
        </form>
      </Form>
    </div>
  );
}
