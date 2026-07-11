"use client";

import { useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { getStepTypeSpec } from "@/lib/workflow-step-catalog";
import type { StepCondition, StepConditionOperator, WorkflowStepDefinition } from "@/lib/api/workflows";

const CONDITION_OPERATORS: StepConditionOperator[] = [
  "eq",
  "neq",
  "exists",
  "not_exists",
  "truthy",
  "falsy",
  "gt",
  "lt",
  "contains",
  "starts_with",
  "ends_with",
  "regex",
  "date_gt",
  "date_lt",
  "empty",
  "not_empty",
];

function isLeafCondition(condition: StepCondition | undefined): condition is import("@/lib/api/workflows").StepConditionLeaf {
  return !!condition && "path" in condition;
}

interface StepConfigPanelProps {
  step: WorkflowStepDefinition;
  allStepIds: string[];
  onChange: (next: WorkflowStepDefinition) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function StepConfigPanel({ step, allStepIds, onChange, onDelete, onClose }: StepConfigPanelProps) {
  const spec = getStepTypeSpec(step.type);
  const [jsonDrafts, setJsonDrafts] = useState<Record<string, string>>({});
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setJsonDrafts({});
    setJsonErrors({});
  }, [step.id]);

  function patch(partial: Partial<WorkflowStepDefinition>) {
    onChange({ ...step, ...partial } as WorkflowStepDefinition);
  }

  function patchConfig(key: string, value: unknown) {
    onChange({ ...step, config: { ...step.config, [key]: value } } as WorkflowStepDefinition);
  }

  function toggleDependsOn(id: string, enabled: boolean) {
    const current = step.dependsOn ?? [];
    const next = enabled ? [...current, id] : current.filter((d) => d !== id);
    patch({ dependsOn: next });
  }

  const hasCondition = !!step.condition;
  const leafCondition = isLeafCondition(step.condition) ? step.condition : undefined;

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-medium">{spec.label}</p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onDelete} aria-label="Delete step">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close panel">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Step id</Label>
            <Input value={step.id} disabled className="font-mono text-xs" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="step-name">Name</Label>
            <Input id="step-name" value={step.name} onChange={(e) => patch({ name: e.target.value })} />
          </div>

          {allStepIds.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label>Depends on</Label>
              <div className="flex flex-col gap-1.5 rounded-lg border border-border p-2">
                {allStepIds.map((id) => (
                  <label key={id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-mono">{id}</span>
                    <Switch
                      checked={(step.dependsOn ?? []).includes(id)}
                      onCheckedChange={(checked) => toggleDependsOn(id, checked)}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          <Separator />

          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Configuration
          </p>

          {spec.fields.map((field) => {
            const rawValue = step.config[field.key];
            if (field.kind === "json") {
              const draftKey = field.key;
              const draft = jsonDrafts[draftKey] ?? JSON.stringify(rawValue ?? (Array.isArray(rawValue) ? [] : {}), null, 2);
              return (
                <div key={field.key} className="flex flex-col gap-2">
                  <Label>{field.label}</Label>
                  <Textarea
                    className="min-h-24 font-mono text-xs"
                    value={draft}
                    placeholder={field.placeholder}
                    onChange={(e) => {
                      const text = e.target.value;
                      setJsonDrafts((d) => ({ ...d, [draftKey]: text }));
                      try {
                        const parsed = text.trim() === "" ? undefined : JSON.parse(text);
                        patchConfig(field.key, parsed);
                        setJsonErrors((errs) => {
                          const next = { ...errs };
                          delete next[draftKey];
                          return next;
                        });
                      } catch {
                        setJsonErrors((errs) => ({ ...errs, [draftKey]: "Invalid JSON" }));
                      }
                    }}
                  />
                  {jsonErrors[draftKey] && <p className="text-xs text-destructive">{jsonErrors[draftKey]}</p>}
                </div>
              );
            }
            if (field.kind === "select") {
              return (
                <div key={field.key} className="flex flex-col gap-2">
                  <Label>{field.label}</Label>
                  <Select
                    value={typeof rawValue === "string" ? rawValue : ""}
                    onValueChange={(v) => patchConfig(field.key, v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={field.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {(field.options ?? []).map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            }
            if (field.kind === "textarea") {
              return (
                <div key={field.key} className="flex flex-col gap-2">
                  <Label>{field.label}</Label>
                  <Textarea
                    value={typeof rawValue === "string" ? rawValue : ""}
                    placeholder={field.placeholder}
                    onChange={(e) => patchConfig(field.key, e.target.value)}
                  />
                </div>
              );
            }
            if (field.kind === "number") {
              return (
                <div key={field.key} className="flex flex-col gap-2">
                  <Label>{field.label}</Label>
                  <Input
                    type="number"
                    value={typeof rawValue === "number" ? rawValue : ""}
                    placeholder={field.placeholder}
                    onChange={(e) => patchConfig(field.key, e.target.value === "" ? undefined : Number(e.target.value))}
                  />
                </div>
              );
            }
            return (
              <div key={field.key} className="flex flex-col gap-2">
                <Label>{field.label}</Label>
                <Input
                  value={typeof rawValue === "string" ? rawValue : ""}
                  placeholder={field.placeholder}
                  onChange={(e) => patchConfig(field.key, e.target.value)}
                />
              </div>
            );
          })}

          <Separator />

          <div className="flex items-center justify-between">
            <Label htmlFor="cond-enabled">Conditional (skip unless true)</Label>
            <Switch
              id="cond-enabled"
              checked={hasCondition}
              onCheckedChange={(checked) =>
                patch({ condition: checked ? { path: "", operator: "truthy" } : undefined })
              }
            />
          </div>

          {hasCondition && leafCondition && (
            <div className="flex flex-col gap-2 rounded-lg border border-border p-2">
              <Label>Path</Label>
              <Input
                className="font-mono text-xs"
                placeholder="context.step_id.output.field"
                value={leafCondition.path}
                onChange={(e) => patch({ condition: { ...leafCondition, path: e.target.value } })}
              />
              <Label>Operator</Label>
              <Select
                value={leafCondition.operator}
                onValueChange={(v) =>
                  patch({ condition: { ...leafCondition, operator: v as StepConditionOperator } })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_OPERATORS.map((op) => (
                    <SelectItem key={op} value={op}>
                      {op}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Label>Value (optional)</Label>
              <Input
                value={typeof leafCondition.value === "string" ? leafCondition.value : leafCondition.value ? String(leafCondition.value) : ""}
                onChange={(e) => patch({ condition: { ...leafCondition, value: e.target.value } })}
              />
              <p className="text-[11px] text-muted-foreground">
                For AND/OR/NOT trees or a value that isn&apos;t a plain string, edit the workflow
                JSON directly (advanced).
              </p>
            </div>
          )}

          {hasCondition && !leafCondition && (
            <p className="rounded-lg border border-border p-2 text-[11px] text-muted-foreground">
              This step has a composite (AND/OR/NOT) condition. Editing composite conditions
              visually isn&apos;t supported yet — use the JSON export/import to change it.
            </p>
          )}

          <Separator />

          <div className="flex flex-col gap-2">
            <Label>Timeout (ms, optional)</Label>
            <Input
              type="number"
              value={step.timeoutMs ?? ""}
              onChange={(e) => patch({ timeoutMs: e.target.value === "" ? undefined : Number(e.target.value) })}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Retry — max attempts (optional)</Label>
            <Input
              type="number"
              value={step.retryPolicy?.maxAttempts ?? ""}
              onChange={(e) => {
                const maxAttempts = e.target.value === "" ? undefined : Number(e.target.value);
                if (maxAttempts === undefined) {
                  patch({ retryPolicy: undefined });
                } else {
                  patch({
                    retryPolicy: {
                      maxAttempts,
                      backoffMs: step.retryPolicy?.backoffMs ?? 1000,
                      backoffMultiplier: step.retryPolicy?.backoffMultiplier,
                    },
                  });
                }
              }}
            />
          </div>
          {step.retryPolicy && (
            <div className="flex flex-col gap-2">
              <Label>Retry — backoff (ms)</Label>
              <Input
                type="number"
                value={step.retryPolicy.backoffMs}
                onChange={(e) =>
                  patch({ retryPolicy: { ...step.retryPolicy!, backoffMs: Number(e.target.value) } })
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
