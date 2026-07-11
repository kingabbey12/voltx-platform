"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutTemplate, Rocket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/page-header";
import { useInstantiateWorkflowTemplate, useWorkflowTemplates } from "@/hooks/use-workflows";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import type { WorkflowTemplate } from "@/lib/api/workflows";

export default function WorkflowTemplatesPage() {
  const router = useRouter();
  const { data, isLoading } = useWorkflowTemplates();
  const instantiate = useInstantiateWorkflowTemplate();
  const [selected, setSelected] = useState<WorkflowTemplate | null>(null);
  const [name, setName] = useState("");

  async function handleInstantiate() {
    if (!selected) return;
    try {
      const workflow = await instantiate.mutateAsync({ key: selected.key, name: name || undefined });
      toast.success(`"${workflow.name}" created from template`);
      setSelected(null);
      setName("");
      router.push(`/workflows/${workflow.id}`);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  const categories = Array.from(new Set(data?.items.map((t) => t.category) ?? []));

  return (
    <div>
      <PageHeader
        title="Templates"
        description="Start from a pre-built, production-ready workflow instead of an empty canvas."
      />

      {isLoading && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-secondary/60" />
          ))}
        </div>
      )}

      {!isLoading && data?.items.length === 0 && (
        <EmptyState
          icon={LayoutTemplate}
          title="No templates available"
          description="Seeded platform templates will appear here."
          className="mt-6"
        />
      )}

      {!isLoading &&
        categories.map((category) => (
          <div key={category} className="mt-8 first:mt-6">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {category}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data?.items
                .filter((t) => t.category === category)
                .map((template) => (
                  <Card key={template.id} className="flex flex-col">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm">{template.name}</CardTitle>
                        {template.isSystem && <Badge variant="secondary">Platform</Badge>}
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col justify-between gap-3 pt-0">
                      <p className="text-xs text-muted-foreground">
                        {template.description ?? `${template.definition.steps.length} steps`}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelected(template);
                          setName(template.name);
                        }}
                      >
                        <Rocket className="h-3.5 w-3.5" />
                        Use template
                      </Button>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        ))}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create workflow from &quot;{selected?.name}&quot;</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="template-name">Workflow name</Label>
            <Input id="template-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Cancel
            </Button>
            <Button onClick={handleInstantiate} isLoading={instantiate.isPending}>
              Create workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
