"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Play, Search, Terminal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useOpenApiDocument } from "@/hooks/use-developer-portal";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { flattenOperations, playgroundRequest, type OpenApiOperation } from "@/lib/api/developer-portal";
import { useAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";

const requestSchema = z.object({
  personalAccessToken: z.string().trim().min(1, "Paste a personal access token"),
  organizationId: z.string().trim().min(1, "Organization ID is required"),
  query: z.string().trim().optional(),
  body: z.string().trim().optional(),
});
type RequestFormValues = z.infer<typeof requestSchema>;

const METHOD_TAKES_BODY = new Set(["POST", "PATCH", "PUT"]);

export default function PlaygroundPage() {
  const { data: document, isLoading } = useOpenApiDocument();
  const organizationId = useAuthStore((state) => state.user?.organizationId);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<OpenApiOperation | null>(null);
  const [response, setResponse] = useState<{ status: number; body: unknown } | null>(null);
  const [sending, setSending] = useState(false);

  const operations = useMemo(() => (document ? flattenOperations(document) : []), [document]);
  const filtered = useMemo(() => {
    if (!search) return operations.slice(0, 30);
    return operations
      .filter(
        (op) =>
          op.path.toLowerCase().includes(search.toLowerCase()) ||
          op.summary?.toLowerCase().includes(search.toLowerCase()),
      )
      .slice(0, 30);
  }, [operations, search]);

  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { personalAccessToken: "", organizationId: organizationId ?? "", query: "", body: "" },
  });

  async function onSubmit(values: RequestFormValues) {
    if (!selected) return;
    setSending(true);
    setResponse(null);
    try {
      const result = await playgroundRequest({
        method: selected.method,
        path: selected.path.replace(/{(\w+)}/g, (_match, name: string) =>
          name === "organizationId" ? values.organizationId : `{${name}}`,
        ),
        organizationId: values.organizationId,
        personalAccessToken: values.personalAccessToken,
        query: values.query,
        body: values.body,
      });
      setResponse(result);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div>
        <h2 className="text-base font-semibold">Playground</h2>
        <p className="text-sm text-muted-foreground">
          Pick a real endpoint and fire an authenticated request against the live API using one of your
          own{" "}
          <a href="/developers/personal-access-tokens" className="underline">
            personal access tokens
          </a>
          . Nothing here is mocked, and your token is only ever held in this page&apos;s memory — never
          saved.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search endpoints…"
              className="pl-9"
            />
          </div>
          <div className="mt-2 flex max-h-[28rem] flex-col gap-1 overflow-y-auto rounded-lg border border-border p-1.5">
            {isLoading && <div className="h-9 animate-pulse rounded-md bg-secondary/60" />}
            {!isLoading &&
              filtered.map((operation) => (
                <button
                  key={`${operation.method}-${operation.path}`}
                  type="button"
                  onClick={() => {
                    setSelected(operation);
                    setResponse(null);
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-secondary",
                    selected?.path === operation.path &&
                      selected.method === operation.method &&
                      "bg-secondary",
                  )}
                >
                  <span className="w-14 shrink-0 font-semibold text-muted-foreground">
                    {operation.method}
                  </span>
                  <span className="truncate font-mono">{operation.path}</span>
                </button>
              ))}
          </div>
        </div>

        <div>
          {!selected && (
            <EmptyState
              icon={Terminal}
              title="Choose an endpoint"
              description="Pick one from the list to build a request."
            />
          )}

          {selected && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <div>
                  <span className="text-xs font-semibold text-muted-foreground">{selected.method}</span>{" "}
                  <code className="text-sm">{selected.path}</code>
                  {selected.summary && (
                    <p className="mt-1 text-sm text-muted-foreground">{selected.summary}</p>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="personalAccessToken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Personal access token</FormLabel>
                      <FormControl>
                        <Input placeholder="vpat_..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="organizationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization ID</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="query"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Query string (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="page=1&limit=20" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {METHOD_TAKES_BODY.has(selected.method) && (
                  <FormField
                    control={form.control}
                    name="body"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Request body (JSON)</FormLabel>
                        <FormControl>
                          <Textarea rows={6} placeholder='{"name": "Example"}' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <Button type="submit" isLoading={sending} className="self-start">
                  <Play className="h-4 w-4" />
                  Send request
                </Button>
              </form>
            </Form>
          )}

          {response && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Response — {response.status}
              </p>
              <pre className="mt-1.5 max-h-96 overflow-auto rounded-lg bg-secondary/60 p-3 text-xs">
                {JSON.stringify(response.body, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
