"use client";

import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/layout/page-header";
import { useInvoices } from "@/hooks/use-billing";
import type { InvoiceStatus } from "@/lib/api/billing";
import { formatCurrency, formatDate } from "@/lib/format";

const STATUS_VARIANT: Record<InvoiceStatus, "success" | "warning" | "destructive" | "secondary" | "outline"> = {
  PAID: "success",
  OPEN: "warning",
  DRAFT: "secondary",
  VOID: "outline",
  UNCOLLECTIBLE: "destructive",
};

export default function BillingInvoicesPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useInvoices(page, 20);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Invoices" description="Billing history for your organization." />

      <div className="rounded-xl border border-border">
        {isLoading && (
          <div className="flex flex-col gap-2 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-secondary/60" />
            ))}
          </div>
        )}

        {!isLoading && data?.items.length === 0 && (
          <EmptyState
            icon={FileText}
            title="No invoices yet"
            description="Invoices appear here once your first billing period closes."
          />
        )}

        {!isLoading && data && data.items.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>{formatDate(invoice.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[invoice.status]}>{invoice.status}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatCurrency(invoice.amountDue, invoice.currency.toUpperCase())}
                  </TableCell>
                  <TableCell>
                    {(invoice.hostedInvoiceUrl || invoice.pdfUrl) && (
                      <a
                        href={invoice.pdfUrl ?? invoice.hostedInvoiceUrl ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Download invoice">
                          <Download className="h-4 w-4" />
                        </Button>
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.page} of {data.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
