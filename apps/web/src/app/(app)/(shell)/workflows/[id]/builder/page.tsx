"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type OnConnect,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { toast } from "sonner";
import {
  ArrowLeft,
  LayoutGrid,
  Redo2,
  Rocket,
  Save,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingScreen } from "@/components/loading-screen";
import { WorkflowStepNode, type WorkflowStepNodeData } from "@/components/workflows/workflow-step-node";
import { StepConfigPanel } from "@/components/workflows/step-config-panel";
import {
  CATEGORY_ORDER,
  STEP_TYPE_CATALOG,
  getStepTypeSpec,
} from "@/lib/workflow-step-catalog";
import {
  usePublishWorkflow,
  useUpdateWorkflowDefinition,
  useWorkflow,
  useWorkflowVersions,
} from "@/hooks/use-workflows";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import type { WorkflowDefinition, WorkflowStepDefinition, WorkflowStepType } from "@/lib/api/workflows";

const NODE_TYPES: NodeTypes = { step: WorkflowStepNode };
const NODE_WIDTH = 220;
const NODE_HEIGHT = 70;

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || "step";
}

function uniqueStepId(name: string, existing: Set<string>): string {
  const base = slugify(name);
  if (!existing.has(base)) return base;
  let n = 2;
  while (existing.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

function layoutWithDagre(definition: WorkflowDefinition): WorkflowDefinition {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 90 });

  for (const step of definition.steps) {
    g.setNode(step.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const step of definition.steps) {
    for (const dep of step.dependsOn ?? []) {
      g.setEdge(dep, step.id);
    }
  }
  dagre.layout(g);

  return {
    ...definition,
    steps: definition.steps.map((step) => {
      const pos = g.node(step.id);
      return { ...step, layout: pos ? { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 } : step.layout };
    }),
  };
}

function definitionToGraph(definition: WorkflowDefinition, errorsByStepId: Record<string, string>) {
  const nodes: Node[] = definition.steps.map((step) => ({
    id: step.id,
    type: "step",
    position: step.layout ?? { x: 0, y: 0 },
    data: {
      name: step.name,
      type: step.type,
      hasCondition: !!step.condition,
      error: errorsByStepId[step.id],
    } satisfies WorkflowStepNodeData,
  }));

  const edges: Edge[] = definition.steps.flatMap((step) =>
    (step.dependsOn ?? []).map((dep) => ({
      id: `${dep}->${step.id}`,
      source: dep,
      target: step.id,
    })),
  );

  return { nodes, edges };
}

function extractErrorStepId(message: string): string | undefined {
  const match = message.match(/Step "([^"]+)"/);
  return match?.[1];
}

function BuilderCanvas({ workflowId }: { workflowId: string }) {
  const router = useRouter();
  const { data: workflow, isLoading: workflowLoading } = useWorkflow(workflowId);
  const { data: versions, isLoading: versionsLoading } = useWorkflowVersions(workflowId);
  const updateDefinition = useUpdateWorkflowDefinition(workflowId);
  const publishWorkflow = usePublishWorkflow();
  const { screenToFlowPosition } = useReactFlow();

  const [definition, setDefinition] = useState<WorkflowDefinition | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<{ stepId?: string; message: string } | null>(null);
  const [historyPast, setHistoryPast] = useState<WorkflowDefinition[]>([]);
  const [historyFuture, setHistoryFuture] = useState<WorkflowDefinition[]>([]);
  const clipboard = useRef<WorkflowStepDefinition | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || versionsLoading) return;
    const latest = versions && versions.length > 0 ? versions[versions.length - 1] : null;
    setDefinition(latest ? latest.definition : { steps: [] });
    initialized.current = true;
  }, [versions, versionsLoading]);

  const errorsByStepId = useMemo(() => {
    if (!saveError?.stepId) return {};
    return { [saveError.stepId]: saveError.message };
  }, [saveError]);

  const graph = useMemo(
    () => (definition ? definitionToGraph(definition, errorsByStepId) : { nodes: [], edges: [] }),
    [definition, errorsByStepId],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);

  useEffect(() => {
    setNodes(graph.nodes);
    setEdges(graph.edges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition]);

  function commit(next: WorkflowDefinition, pushHistory = true) {
    if (pushHistory && definition) {
      setHistoryPast((h) => [...h.slice(-49), definition]);
      setHistoryFuture([]);
    }
    setDefinition(next);
    setSaveError(null);
  }

  function undo() {
    if (historyPast.length === 0 || !definition) return;
    const prev = historyPast[historyPast.length - 1];
    if (!prev) return;
    setHistoryPast((h) => h.slice(0, -1));
    setHistoryFuture((f) => [...f, definition]);
    setDefinition(prev);
  }

  function redo() {
    if (historyFuture.length === 0 || !definition) return;
    const next = historyFuture[historyFuture.length - 1];
    if (!next) return;
    setHistoryFuture((f) => f.slice(0, -1));
    setHistoryPast((h) => [...h, definition]);
    setDefinition(next);
  }

  const updateStep = useCallback(
    (stepId: string, next: WorkflowStepDefinition) => {
      if (!definition) return;
      commit({ ...definition, steps: definition.steps.map((s) => (s.id === stepId ? next : s)) });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [definition],
  );

  function deleteStep(stepId: string) {
    if (!definition) return;
    commit({
      ...definition,
      steps: definition.steps
        .filter((s) => s.id !== stepId)
        .map((s) => ({ ...s, dependsOn: (s.dependsOn ?? []).filter((d) => d !== stepId) })),
    });
    setSelectedStepId(null);
  }

  function addStep(type: WorkflowStepType, position: { x: number; y: number }) {
    if (!definition) return;
    const spec = getStepTypeSpec(type);
    const existingIds = new Set(definition.steps.map((s) => s.id));
    const id = uniqueStepId(spec.label, existingIds);
    const newStep = {
      id,
      name: spec.label,
      type,
      config: { ...spec.defaultConfig },
      layout: position,
    } as WorkflowStepDefinition;
    commit({ ...definition, steps: [...definition.steps, newStep] });
    setSelectedStepId(id);
  }

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!definition || !connection.source || !connection.target) return;
      const target = definition.steps.find((s) => s.id === connection.target);
      if (!target) return;
      if ((target.dependsOn ?? []).includes(connection.source)) return;
      commit({
        ...definition,
        steps: definition.steps.map((s) =>
          s.id === target.id ? { ...s, dependsOn: [...(s.dependsOn ?? []), connection.source!] } : s,
        ),
      });
      setEdges((eds) => addEdge(connection, eds));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [definition],
  );

  function onNodeDragStop(_: unknown, node: Node) {
    if (!definition) return;
    commit(
      {
        ...definition,
        steps: definition.steps.map((s) => (s.id === node.id ? { ...s, layout: node.position } : s)),
      },
      false,
    );
  }

  function onEdgesDelete(deleted: Edge[]) {
    if (!definition) return;
    let next = definition;
    for (const edge of deleted) {
      next = {
        ...next,
        steps: next.steps.map((s) =>
          s.id === edge.target ? { ...s, dependsOn: (s.dependsOn ?? []).filter((d) => d !== edge.source) } : s,
        ),
      };
    }
    commit(next);
  }

  function handleAutoLayout() {
    if (!definition) return;
    commit(layoutWithDagre(definition));
  }

  async function handleSave() {
    if (!definition) return;
    try {
      await updateDefinition.mutateAsync(definition);
      toast.success("Workflow saved as a new version");
      setSaveError(null);
    } catch (error) {
      const message = friendlyErrorMessage(error);
      setSaveError({ stepId: extractErrorStepId(message), message });
      toast.error(message);
    }
  }

  async function handlePublish() {
    try {
      await handleSave();
      await publishWorkflow.mutateAsync(workflowId);
      toast.success("Workflow published");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    const type = event.dataTransfer.getData("application/voltx-step-type") as WorkflowStepType;
    if (!type) return;
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    addStep(type, { x: position.x - NODE_WIDTH / 2, y: position.y - NODE_HEIGHT / 2 });
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;
      if (!meta || !definition) return;
      if (event.key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((event.key === "z" && event.shiftKey) || event.key === "y") {
        event.preventDefault();
        redo();
      } else if (event.key === "c" && selectedStepId) {
        const step = definition.steps.find((s) => s.id === selectedStepId);
        if (step) clipboard.current = step;
      } else if (event.key === "v" && clipboard.current) {
        event.preventDefault();
        const existingIds = new Set(definition.steps.map((s) => s.id));
        const id = uniqueStepId(`${clipboard.current.name}_copy`, existingIds);
        const pasted = {
          ...clipboard.current,
          id,
          dependsOn: [],
          layout: {
            x: (clipboard.current.layout?.x ?? 0) + 40,
            y: (clipboard.current.layout?.y ?? 0) + 40,
          },
        };
        commit({ ...definition, steps: [...definition.steps, pasted] });
        setSelectedStepId(id);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition, selectedStepId]);

  if (workflowLoading || versionsLoading || !definition) return <LoadingScreen />;
  if (!workflow) return null;

  const selectedStep = definition.steps.find((s) => s.id === selectedStepId) ?? null;
  const allOtherStepIds = definition.steps.map((s) => s.id).filter((id) => id !== selectedStepId);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/workflows/${workflowId}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <p className="text-sm font-medium leading-tight">{workflow.name}</p>
            <p className="text-xs leading-tight text-muted-foreground">Visual builder</p>
          </div>
          <Badge variant={workflow.status === "PUBLISHED" ? "success" : "secondary"}>{workflow.status}</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={undo} disabled={historyPast.length === 0}>
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={redo} disabled={historyFuture.length === 0}>
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleAutoLayout}>
            <LayoutGrid className="h-3.5 w-3.5" />
            Auto-layout
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave} isLoading={updateDefinition.isPending}>
            <Save className="h-3.5 w-3.5" />
            Save
          </Button>
          <Button size="sm" onClick={handlePublish} isLoading={publishWorkflow.isPending}>
            <Rocket className="h-3.5 w-3.5" />
            Publish
          </Button>
        </div>
      </div>

      {saveError && (
        <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {saveError.message}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="w-56 shrink-0 overflow-y-auto border-r border-border p-3">
          {CATEGORY_ORDER.map((category) => (
            <div key={category} className="mb-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {category}
              </p>
              <div className="flex flex-col gap-1.5">
                {STEP_TYPE_CATALOG.filter((s) => s.category === category).map((spec) => (
                  <div
                    key={spec.type}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("application/voltx-step-type", spec.type)}
                    onClick={() => addStep(spec.type, { x: 40, y: 40 + definition.steps.length * 90 })}
                    className="flex cursor-grab items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-xs hover:bg-secondary/60 active:cursor-grabbing"
                    title={spec.description}
                  >
                    <spec.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    {spec.label}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="relative flex-1" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            onEdgesDelete={onEdgesDelete}
            onNodeClick={(_, node) => setSelectedStepId(node.id)}
            onPaneClick={() => setSelectedStepId(null)}
            fitView
            colorMode="system"
          >
            <Background gap={16} />
            <Controls />
            <MiniMap pannable zoomable className="!bg-card" />
          </ReactFlow>
        </div>

        {selectedStep && (
          <StepConfigPanel
            key={selectedStep.id}
            step={selectedStep}
            allStepIds={allOtherStepIds}
            onChange={(next) => updateStep(selectedStep.id, next)}
            onDelete={() => deleteStep(selectedStep.id)}
            onClose={() => setSelectedStepId(null)}
          />
        )}
      </div>
    </div>
  );
}

export default function WorkflowBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ReactFlowProvider>
      <BuilderCanvas workflowId={id} />
    </ReactFlowProvider>
  );
}
