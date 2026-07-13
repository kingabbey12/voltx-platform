"use client";

import { useQuery } from "@tanstack/react-query";
import { PackageOpen } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiClient } from "@/lib/api/client";
import type { ExtensionComponentNode } from "@/lib/api/extensions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * Renders a marketplace app's Custom Page/Widget manifest tree — the
 * entire security boundary for the Extension Framework's declarative
 * side (see backend/src/modules/extensions/utils/manifest-validator.ts,
 * which already validated every node's `type` against this exact
 * palette at submission time). A developer's manifest can only ever
 * reference the component names handled below; there is no path from a
 * manifest to arbitrary rendered code. Any `dataSource` a node declares
 * is fetched through the installing organization's own authenticated
 * apiClient — never the developer's own credentials — so an installed
 * app only ever sees what the viewing user could already see themselves.
 */
export function ManifestRenderer({ node }: { node: ExtensionComponentNode }) {
  switch (node.type) {
    case "section":
      return <SectionNode node={node} />;
    case "text":
      return <TextNode node={node} />;
    case "stat-card":
      return <StatCardNode node={node} />;
    case "table":
      return <TableNode node={node} />;
    case "list":
      return <ListNode node={node} />;
    case "chart":
      return <ChartNode node={node} />;
    case "form":
      return <FormNode node={node} />;
    case "button":
      return <ButtonNode node={node} />;
    default:
      return null;
  }
}

function useNodeData(node: ExtensionComponentNode) {
  return useQuery({
    queryKey: ["extension-data-source", node.dataSource?.method, node.dataSource?.path],
    queryFn: () => {
      const dataSource = node.dataSource!;
      return dataSource.method === "POST"
        ? apiClient.post<unknown>(dataSource.path, {})
        : apiClient.get<unknown>(dataSource.path);
    },
    enabled: !!node.dataSource,
  });
}

function asRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value as Record<string, unknown>[];
  }
  if (value && typeof value === "object" && Array.isArray((value as { items?: unknown }).items)) {
    return (value as { items: Record<string, unknown>[] }).items;
  }
  return [];
}

function SectionNode({ node }: { node: ExtensionComponentNode }) {
  const title = typeof node.props?.title === "string" ? node.props.title : undefined;
  return (
    <div className="flex flex-col gap-4">
      {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(node.children ?? []).map((child, index) => (
          <ManifestRenderer key={index} node={child} />
        ))}
      </div>
    </div>
  );
}

function TextNode({ node }: { node: ExtensionComponentNode }) {
  const text = typeof node.props?.text === "string" ? node.props.text : "";
  return <p className="text-sm text-muted-foreground">{text}</p>;
}

function StatCardNode({ node }: { node: ExtensionComponentNode }) {
  const label = typeof node.props?.label === "string" ? node.props.label : "Stat";
  const valueField = typeof node.props?.valueField === "string" ? node.props.valueField : "value";
  const { data, isLoading } = useNodeData(node);
  const dataValue =
    data && typeof data === "object" ? (data as Record<string, unknown>)[valueField] : undefined;
  const staticValue = node.props?.value;
  const value = dataValue ?? staticValue ?? (isLoading ? "…" : "—");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <span className="text-2xl font-semibold tabular-nums">{String(value)}</span>
      </CardContent>
    </Card>
  );
}

function TableNode({ node }: { node: ExtensionComponentNode }) {
  const { data, isLoading } = useNodeData(node);
  const rows = asRows(data);
  const columns = typeof node.props?.columns === "object" ? (node.props.columns as string[]) : undefined;
  const columnKeys = columns ?? (rows[0] ? Object.keys(rows[0]) : []);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (rows.length === 0) {
    return <EmptyState icon={PackageOpen} title="No data" description="This widget has nothing to show yet." />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columnKeys.map((key) => (
            <TableHead key={key}>{key}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={index}>
            {columnKeys.map((key) => (
              <TableCell key={key}>{String(row[key] ?? "")}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ListNode({ node }: { node: ExtensionComponentNode }) {
  const { data, isLoading } = useNodeData(node);
  const rows = asRows(data);
  const labelField = typeof node.props?.labelField === "string" ? node.props.labelField : "label";

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <ul className="flex flex-col gap-2 text-sm">
      {rows.map((row, index) => (
        <li key={index} className="rounded-md border border-border px-3 py-2">
          {String(row[labelField] ?? JSON.stringify(row))}
        </li>
      ))}
    </ul>
  );
}

function ChartNode({ node }: { node: ExtensionComponentNode }) {
  const { data, isLoading } = useNodeData(node);
  const rows = asRows(data);
  const xKey = typeof node.props?.xKey === "string" ? node.props.xKey : "label";
  const yKey = typeof node.props?.yKey === "string" ? node.props.yKey : "value";
  const variant = node.props?.variant === "bar" ? "bar" : "line";

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (rows.length === 0) {
    return <EmptyState icon={PackageOpen} title="No data" description="This chart has nothing to show yet." />;
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {variant === "bar" ? (
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <RechartsTooltip />
            <Bar dataKey={yKey} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : (
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <RechartsTooltip />
            <Line type="monotone" dataKey={yKey} stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function FormNode({ node }: { node: ExtensionComponentNode }) {
  const title = typeof node.props?.title === "string" ? node.props.title : undefined;
  const fields = Array.isArray(node.props?.fields) ? (node.props?.fields as { name: string; label: string }[]) : [];

  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className="flex flex-col gap-3">
        {fields.map((field) => (
          <label key={field.name} className="flex flex-col gap-1 text-xs text-muted-foreground">
            {field.label}
            <input
              name={field.name}
              className="rounded-md border border-input bg-background px-2 py-1 text-sm"
            />
          </label>
        ))}
        <ButtonNode node={{ type: "button", props: { label: "Submit" }, dataSource: node.dataSource }} />
      </CardContent>
    </Card>
  );
}

function ButtonNode({ node }: { node: ExtensionComponentNode }) {
  const label = typeof node.props?.label === "string" ? node.props.label : "Run";
  const { refetch, isFetching } = useNodeData(node);

  return (
    <Button size="sm" disabled={!node.dataSource || isFetching} onClick={() => void refetch()}>
      {isFetching ? "Working…" : label}
    </Button>
  );
}
