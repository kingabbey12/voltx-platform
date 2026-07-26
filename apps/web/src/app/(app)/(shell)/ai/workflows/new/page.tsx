"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Workflow } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { useCreateWorkflow } from "@/hooks/use-workflows";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import type { WorkflowStepType, WorkflowStepDefinition } from "@/lib/api/workflows";

const STEP_TYPE_OPTIONS: { label: string; value: WorkflowStepType; description: string }[] = [
  { label: "AI Agent", value: "AGENT", description: "Runs an AI agent with objective and tool access" },
  { label: "Run Tool", value: "TOOL", description: "Calls a single tool directly" },
  { label: "HTTP Request", value: "API", description: "Calls an external HTTP endpoint" },
  { label: "Send Webhook", value: "WEBHOOK", description: "Posts JSON to an external URL" },
  { label: "Send Notification", value: "NOTIFICATION", description: "Sends an in-app notification" },
  { label: "Require Approval", value: "APPROVAL", description: "Pauses for human approval" },
  { label: "Delay", value: "DELAY", description: "Pauses execution for a duration" },
  { label: "Loop", value: "LOOP", description: "Iterates over an array and runs nested steps" },
  { label: "Switch", value: "SWITCH", description: "Branches based on a resolved value" },
  { label: "Integration", value: "INTEGRATION", description: "Calls a third-party integration action" },
];

let stepCounter = 0;
function makeStep(type: WorkflowStepType): WorkflowStepDefinition {
  stepCounter++;
  return {
    id: `step-${stepCounter}`,
    name: STEP_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type,
    type,
    config: {},
    dependsOn: stepCounter > 1 ? [`step-${stepCounter - 1}`] : undefined,
  };
}

export default function NewWorkflowPage() {
  const router = useRouter();
  const createWorkflow = useCreateWorkflow();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<WorkflowStepDefinition[]>([makeStep("AGENT")]);

  function addStep(type: WorkflowStepType) {
    setSteps((prev) => [...prev, makeStep(type)]);
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function updateStep(index: number, field: string, value: string) {
    setSteps((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, [field]: field === "type" ? (value as WorkflowStepType) : value } : s,
      ),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Workflow name is required");
      return;
    }
    if (steps.length === 0) {
      toast.error("Add at least one step");
      return;
    }
    try {
      const wf = await createWorkflow.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        definition: { steps },
      });
      toast.success("Workflow created");
      router.push(`/ai/workflows/${wf.id}/edit`);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Button variant="ghost" size="sm" onClick={() => router.push("/ai/workflows")} className="mb-4 -ml-2">
        <ArrowLeft className="h-4 w-4" />
        Workflows
      </Button>

      <PageHeader
        title="New workflow"
        description="Define the steps your workflow will execute."
        className="mb-6"
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Basic info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wf-name">Name</Label>
              <Input
                id="wf-name"
                placeholder="Lead Qualification Pipeline"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wf-desc">Description (optional)</Label>
              <Textarea
                id="wf-desc"
                placeholder="Qualifies inbound leads using AI scoring and routing."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Steps</CardTitle>
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-muted-foreground">{steps.length} step{steps.length === 1 ? "" : "s"}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {steps.map((step, i) => (
              <div
                key={step.id}
                className="flex items-start gap-3 rounded-lg border border-border p-3"
              >
                <Badge variant="secondary" className="mt-0.5 shrink-0">
                  {i + 1}
                </Badge>
                <div className="flex flex-1 flex-col gap-3 sm:flex-row">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Type</Label>
                    <Select
                      value={step.type}
                      onValueChange={(v) => updateStep(i, "type", v)}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STEP_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-[2] space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Name</Label>
                    <Input
                      className="h-8"
                      value={step.name}
                      onChange={(e) => updateStep(i, "name", e.target.value)}
                      placeholder="Step name"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-5 h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeStep(i)}
                  disabled={steps.length === 1}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}

            <div className="flex flex-wrap gap-2 pt-2">
              <p className="w-full text-xs text-muted-foreground mb-1">Add step:</p>
              {(["AGENT", "TOOL", "API", "APPROVAL", "DELAY", "NOTIFICATION"] as WorkflowStepType[]).map((type) => {
                const opt = STEP_TYPE_OPTIONS.find((o) => o.value === type)!;
                return (
                  <Button
                    key={type}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addStep(type)}
                  >
                    <Plus className="h-3 w-3" />
                    {opt.label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.push("/ai/workflows")}>
            Cancel
          </Button>
          <Button type="submit" isLoading={createWorkflow.isPending}>
            <Workflow className="h-4 w-4" />
            Create workflow
          </Button>
        </div>
      </form>
    </div>
  );
}
