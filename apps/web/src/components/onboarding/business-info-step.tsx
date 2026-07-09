"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox, type ComboboxGroup } from "@/components/ui/combobox";
import { useOrganizationProfile, useUpdateBusinessInfo } from "@/hooks/use-onboarding";
import {
  useCitiesForState,
  useCountries,
  useCurrencies,
  useIndustries,
  useLanguages,
  useStatesForCountry,
  useTimezones,
} from "@/hooks/use-reference-data";
import {
  businessInfoSchema,
  COMPANY_SIZE_OPTIONS,
  PRIMARY_GOAL_OPTIONS,
  type BusinessInfoFormValues,
} from "@/lib/validations/onboarding";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import type { CompanySize } from "@/lib/api/organizations";

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-muted-foreground/80">{description}</p>}
    </div>
  );
}

export function BusinessInfoStep({ onNext }: { onNext: () => void }) {
  const { data: organization, isLoading } = useOrganizationProfile();
  const updateBusinessInfo = useUpdateBusinessInfo();

  const { data: countries, isLoading: countriesLoading } = useCountries();
  const { data: industryGroups, isLoading: industriesLoading } = useIndustries();
  const { data: currencies } = useCurrencies();
  const { data: timezones } = useTimezones();
  const { data: languages } = useLanguages();

  const form = useForm<BusinessInfoFormValues>({
    resolver: zodResolver(businessInfoSchema),
    defaultValues: {
      name: "",
      email: "",
      website: "",
      industry: "",
      country: "",
      state: "",
      city: "",
      companySize: "",
      primaryGoals: [],
      currency: "",
      language: "",
      timezone: "",
      phone: "",
    },
  });

  const selectedCountry = form.watch("country");
  const selectedState = form.watch("state");
  const { data: states, isLoading: statesLoading } = useStatesForCountry(selectedCountry || undefined);
  const { data: cities, isLoading: citiesLoading } = useCitiesForState(
    selectedCountry || undefined,
    selectedState || undefined,
  );

  const [autoFilledFromCountry, setAutoFilledFromCountry] = useState(false);
  const [defaultsApplied, setDefaultsApplied] = useState(false);

  useEffect(() => {
    if (!organization) return;
    form.reset({
      name: organization.name,
      email: organization.email ?? "",
      website: organization.website ?? "",
      industry: organization.industry ?? "",
      country: organization.country ?? "",
      state: organization.state ?? "",
      city: organization.city ?? "",
      companySize: organization.companySize ?? "",
      primaryGoals: organization.primaryGoals ?? [],
      currency: organization.currency ?? "",
      language: organization.language ?? "",
      timezone: organization.timezone ?? "",
      phone: organization.phone ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization]);

  // Default preferred language from the browser once, only if the
  // organization hasn't already saved one and languages have loaded.
  useEffect(() => {
    if (defaultsApplied || !languages || form.getValues("language")) return;
    const browserLang = typeof navigator !== "undefined" ? navigator.language.split("-")[0] : undefined;
    const match = languages.find((lang) => lang.code === browserLang);
    if (match) {
      form.setValue("language", match.code);
    }
    setDefaultsApplied(true);
  }, [defaultsApplied, languages, form]);

  const selectedCountryData = useMemo(
    () => countries?.find((c) => c.isoCode === selectedCountry),
    [countries, selectedCountry],
  );

  // Country changed by the user (not the initial profile load) — auto-fill
  // currency/timezone/phone prefix, reset dependent state/city. Users can
  // still edit any of these afterward; this only fires on a real change.
  function handleCountryChange(iso2: string) {
    const country = countries?.find((c) => c.isoCode === iso2);
    form.setValue("country", iso2);
    form.setValue("state", "");
    form.setValue("city", "");
    if (country) {
      form.setValue("currency", country.currency);
      if (country.timezone) {
        form.setValue("timezone", country.timezone);
      }
      const currentPhone = form.getValues("phone") ?? "";
      const digitsOnly = currentPhone.replace(/^\+\d+/, "").trim();
      // Only write a combined value if there are real digits to re-prefix —
      // writing a prefix-only string (e.g. "+971") would be non-empty but
      // fail phone validation, since the field is meant to be optional
      // until the user actually types a number. The prefix chip itself is
      // rendered independently from selectedCountryData, not from this.
      if (digitsOnly.length > 0) {
        form.setValue("phone", `${country.phoneCode}${digitsOnly}`);
      }
      setAutoFilledFromCountry(true);
    }
  }

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

  const stateOptions = useMemo(
    () => (states ?? []).map((s) => ({ value: s.isoCode, label: s.name })),
    [states],
  );

  const cityOptions = useMemo(() => (cities ?? []).map((c) => ({ value: c.name, label: c.name })), [cities]);

  const currencyOptions = useMemo(
    () =>
      (currencies ?? []).map((c) => ({
        value: c.code,
        label: `${c.code} — ${c.countryName}`,
        keywords: [c.code, c.countryName],
      })),
    [currencies],
  );

  const timezoneOptions = useMemo(
    () => (timezones ?? []).map((tz) => ({ value: tz, label: tz.replace(/_/g, " ") })),
    [timezones],
  );

  const languageOptions = useMemo(
    () => (languages ?? []).map((lang) => ({ value: lang.code, label: lang.name })),
    [languages],
  );

  const phoneCode = selectedCountryData?.phoneCode ?? "";
  const phoneValue = form.watch("phone") ?? "";
  const phoneDigits = phoneCode && phoneValue.startsWith(phoneCode) ? phoneValue.slice(phoneCode.length) : phoneValue;

  async function onSubmit(values: BusinessInfoFormValues) {
    try {
      await updateBusinessInfo.mutateAsync({
        name: values.name,
        email: values.email,
        website: values.website || undefined,
        industry: values.industry,
        country: values.country,
        state: values.state || undefined,
        city: values.city || undefined,
        companySize: values.companySize as CompanySize,
        primaryGoals: values.primaryGoals,
        currency: values.currency || undefined,
        language: values.language || undefined,
        timezone: values.timezone || undefined,
        phone: values.phone || undefined,
      });
      onNext();
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  const disabled = isLoading || updateBusinessInfo.isPending;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Tell us about your business</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        This helps Voltx tailor agents, workflows, and defaults to how you actually work.
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 flex flex-col gap-8">
          <section>
            <SectionHeading title="Business identity" />
            <div className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Inc." disabled={disabled} autoFocus {...field} />
                    </FormControl>
                    <FormDescription>Enter your company or organization name.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Email *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="hello@acme.com" disabled={disabled} {...field} />
                      </FormControl>
                      <FormDescription>Used for notifications and communication.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com" disabled={disabled} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </section>

          <section>
            <SectionHeading title="Classification" />
            <div className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industry *</FormLabel>
                    <FormControl>
                      <Combobox
                        options={industryOptions}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder={industriesLoading ? "Loading..." : "Select an industry"}
                        searchPlaceholder="Search industries..."
                        disabled={disabled || industriesLoading}
                        aria-invalid={!!form.formState.errors.industry}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="companySize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Size *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                        <FormControl>
                          <SelectTrigger aria-invalid={!!form.formState.errors.companySize}>
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {COMPANY_SIZE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
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
                  name="primaryGoals"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Goal *</FormLabel>
                      <FormControl>
                        <Combobox
                          multiple
                          options={PRIMARY_GOAL_OPTIONS}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select goals"
                          searchPlaceholder="Search goals..."
                          disabled={disabled}
                          aria-invalid={!!form.formState.errors.primaryGoals}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </section>

          <section>
            <SectionHeading title="Location" />
            <div className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country / Region *</FormLabel>
                    <FormControl>
                      <Combobox
                        options={countryOptions}
                        value={field.value}
                        onChange={handleCountryChange}
                        placeholder={countriesLoading ? "Loading..." : "Select a country"}
                        searchPlaceholder="Search countries..."
                        disabled={disabled || countriesLoading}
                        aria-invalid={!!form.formState.errors.country}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State / Province</FormLabel>
                      <FormControl>
                        <Combobox
                          options={stateOptions}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder={
                            !selectedCountry
                              ? "Select a country first"
                              : statesLoading
                                ? "Loading..."
                                : stateOptions.length === 0
                                  ? "No states available"
                                  : "Select a state"
                          }
                          searchPlaceholder="Search states..."
                          disabled={disabled || !selectedCountry || stateOptions.length === 0}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Combobox
                          options={cityOptions}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder={
                            !selectedState
                              ? "Select a state first"
                              : citiesLoading
                                ? "Loading..."
                                : cityOptions.length === 0
                                  ? "No cities available"
                                  : "Select a city"
                          }
                          searchPlaceholder="Search cities..."
                          disabled={disabled || !selectedState || cityOptions.length === 0}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </section>

          <section>
            <SectionHeading
              title="Locale & contact"
              description={
                autoFilledFromCountry
                  ? "Auto-filled from your country — feel free to change any of these."
                  : undefined
              }
            />
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Currency</FormLabel>
                      <FormControl>
                        <Combobox
                          options={currencyOptions}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select a currency"
                          searchPlaceholder="Search currencies..."
                          disabled={disabled}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Language</FormLabel>
                      <FormControl>
                        <Combobox
                          options={languageOptions}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select a language"
                          searchPlaceholder="Search languages..."
                          disabled={disabled}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <FormControl>
                      <Combobox
                        options={timezoneOptions}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select a timezone"
                        searchPlaceholder="Search timezones..."
                        disabled={disabled}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={() => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <div className="flex items-stretch gap-2">
                        <span className="flex h-10 shrink-0 items-center rounded-lg border border-input bg-secondary px-3 text-sm text-secondary-foreground">
                          {phoneCode || "+--"}
                        </span>
                        <Input
                          value={phoneDigits}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/[^\d]/g, "");
                            form.setValue("phone", digits.length > 0 ? `${phoneCode}${digits}` : "");
                          }}
                          placeholder="501234567"
                          disabled={disabled || !phoneCode}
                          className="flex-1"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          <Button type="submit" size="lg" className="w-full" isLoading={updateBusinessInfo.isPending} disabled={isLoading}>
            Continue
          </Button>
        </form>
      </Form>
    </div>
  );
}
