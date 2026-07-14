"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CheckCircle2, Download, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuditExport, useCreateAuditExport, useVerifyAuditChain } from "@/hooks/use-compliance";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import type { AuditChainVerifyResult } from "@/lib/api/compliance";
import { formatDate } from "@/lib/format";

const createSchema = z
  .object({
    fromDate: z.string().min(1, "Required"),
    toDate: z.string().min(1, "Required"),
    format: z.enum(["JSON", "CSV"]),
  })
  .refine((values) => new Date(values.fromDate) <= new Date(values.toDate), {
    message: "From date must be before to date",
    path: ["toDate"],
  });
type CreateFormValues = z.infer<typeof createSchema>;

const STATUS_VARIANT = {
  PENDING: "secondary",
  PROCESSING: "info",
  COMPLETED: "success",
  FAILED: "destructive",
} as const;

export default function AuditLogPage() {
  const createExport = useCreateAuditExport();
  const verifyChain = useVerifyAuditChain();
  const [exportId, setExportId] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<AuditChainVerifyResult | null>(null);

  const { data: exportStatus } = useAuditExport(exportId);

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { fromDate: "", toDate: "", format: "JSON" },
  });

  async function onSubmit(values: CreateFormValues) {
    try {
      const result = await createExport.mutateAsync({
        fromDate: new Date(values.fromDate).toISOString(),
        toDate: new Date(values.toDate).toISOString(),
        format: values.format,
      });
      setExportId(result.id);
      toast.success("Export requested");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function onVerify() {
    try {
      const result = await verifyChain.mutateAsync();
      setVerifyResult(result);
      if (result.valid) {
        toast.success("Audit chain is intact");
      } else {
        toast.error("Audit chain integrity check failed");
      }
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <h2 className="text-base font-semibold">Export audit log</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate a downloadable export of every audit event in a date range.
        </p>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="fromDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="toDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="format"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Format</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="JSON">JSON</SelectItem>
                      <SelectItem value="CSV">CSV</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="sm:col-span-3">
              <Button type="submit" isLoading={createExport.isPending}>
                Request export
              </Button>
            </div>
          </form>
        </Form>

        {exportStatus && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-secondary/40 p-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANT[exportStatus.status]}>{exportStatus.status}</Badge>
                <span className="text-sm text-muted-foreground">
                  {formatDate(exportStatus.fromDate)} – {formatDate(exportStatus.toDate)} (
                  {exportStatus.format})
                </span>
              </div>
              {exportStatus.rowCount !== null && (
                <p className="mt-1 text-xs text-muted-foreground">{exportStatus.rowCount} rows</p>
              )}
              {exportStatus.errorMessage && (
                <p className="mt-1 text-xs text-destructive">{exportStatus.errorMessage}</p>
              )}
            </div>
            {exportStatus.downloadUrl && (
              <a href={exportStatus.downloadUrl} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline">
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
              </a>
            )}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-base font-semibold">Verify audit chain integrity</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Audit log entries are hash-chained — verify that none have been tampered with or removed.
        </p>
        <Button className="mt-4" variant="outline" onClick={onVerify} isLoading={verifyChain.isPending}>
          <ShieldCheck className="h-4 w-4" />
          Run verification
        </Button>

        {verifyResult && (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-border bg-secondary/40 p-4">
            {verifyResult.valid ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            ) : (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            )}
            <div>
              <p className="font-medium text-foreground">
                {verifyResult.valid ? "Chain intact" : "Chain integrity broken"}
              </p>
              <p className="text-sm text-muted-foreground">{verifyResult.checked} entries checked.</p>
              {!verifyResult.valid && (
                <p className="mt-1 text-sm text-destructive">
                  Broken at index {verifyResult.brokenAtIndex} (log entry {verifyResult.brokenAuditLogId})
                </p>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
