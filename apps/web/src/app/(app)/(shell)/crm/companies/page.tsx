"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Building2, Globe2, MoreHorizontal, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryErrorState } from "@/components/query-error-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCompanies, useCreateCompany, useDeleteCompany } from "@/hooks/use-sales";
import { companySchema, type CompanyFormValues } from "@/lib/validations/crm";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import type { CompanyStatus } from "@/lib/api/sales";

const STATUS_VARIANT: Record<CompanyStatus, "secondary" | "success" | "outline"> = {
  PROSPECT: "secondary",
  ACTIVE: "success",
  INACTIVE: "outline",
};

export default function CompaniesPage() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, isLoading, isError, refetch } = useCompanies({
    search: search || undefined,
    limit: 50,
  });
  const createCompany = useCreateCompany();
  const deleteCompany = useDeleteCompany();

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: { name: "", domain: "", industry: "", status: "PROSPECT" },
  });

  async function onSubmit(values: CompanyFormValues) {
    try {
      await createCompany.mutateAsync({
        name: values.name,
        domain: values.domain || undefined,
        industry: values.industry || undefined,
        status: values.status,
      });
      toast.success("Company created");
      setDialogOpen(false);
      form.reset();
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteCompany.mutateAsync(id);
      toast.success("Company deleted");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div className="space-y-5">
      <div className="surface-widget flex flex-col gap-4 rounded-[24px] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-info">Accounts</p><p className="mt-1 text-sm text-muted-foreground">{data?.total ?? 0} companies in your customer graph</p></div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search companies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 min-w-[220px] rounded-xl border-white/[0.09] bg-black/25"
        />
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add company
        </Button></div>
      </div>

      <div className="surface-widget overflow-hidden rounded-[24px]">
        {isLoading && (
          <div className="flex flex-col gap-3 p-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-24 w-full rounded-2xl" />
            ))}
          </div>
        )}

        {!isLoading && isError && (
          <QueryErrorState title="Companies could not be loaded" onRetry={() => void refetch()} />
        )}

        {!isLoading && !isError && data?.items.length === 0 && (
          <EmptyState
            icon={Building2}
            title="Start your customer graph"
            description="Add the first account you want Voltx to help you understand and grow."
            action={
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Add company
              </Button>
            }
          />
        )}

        {!isLoading && !isError && data && data.items.length > 0 && (
          <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.items.map((company) => (
                <article key={company.id} className="surface-interactive group relative min-h-[190px] overflow-hidden rounded-2xl p-5">
                  <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-info/10 blur-3xl transition-transform duration-300 group-hover:scale-125" />
                  <div className="relative flex items-start justify-between gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl border border-info/20 bg-info/10 text-info shadow-[0_10px_22px_-16px_hsl(var(--info)/0.9)]"><Building2 className="h-5 w-5" /></span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="relative z-10 h-8 w-8" aria-label="More options">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(company.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu></div>
                    <Link href={`/crm/companies/${company.id}`} className="relative mt-5 block rounded-lg focus-visible:ring-2 focus-visible:ring-ring"><p className="truncate text-base font-semibold tracking-tight transition-colors group-hover:text-primary">{company.name}</p><p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground"><Globe2 className="h-3.5 w-3.5" />{company.domain ?? company.industry ?? "Account context is being built"}</p></Link>
                    <div className="relative mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3"><Badge variant={STATUS_VARIANT[company.status]}>{company.status}</Badge><span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Sparkles className="h-3 w-3 text-info" />Customer record</span></div>
                  </article>
              ))}
            </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add company</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company name</FormLabel>
                    <FormControl>
                      <Input autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="domain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Domain (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="acme.com" {...field} />
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
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PROSPECT">Prospect</SelectItem>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="INACTIVE">Inactive</SelectItem>
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
                <Button type="submit" isLoading={createCompany.isPending}>
                  Add company
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
