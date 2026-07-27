"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  TestTube,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AI_PROVIDER_NAMES,
  type AIProviderName,
} from "@/lib/api/ai-settings";
import {
  useAiCredentials,
  useCreateAiCredential,
  useDeleteAiCredential,
  useRotateAiCredential,
  useTestAiCredential,
  useUpdateAiCredential,
} from "@/hooks/use-ai-settings";
import { friendlyErrorMessage } from "@/lib/api/api-error";

const PROVIDER_LABELS: Record<AIProviderName, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google Gemini",
  xai: "xAI (Grok)",
  groq: "Groq",
  mistral: "Mistral AI",
  deepseek: "DeepSeek",
  ollama: "Ollama",
  openrouter: "OpenRouter",
  "azure-openai": "Azure OpenAI",
};

const PROVIDER_DESCRIPTIONS: Record<AIProviderName, string> = {
  openai: "GPT-4o, GPT-4, o3, o1, and other OpenAI models",
  anthropic: "Claude 4, Claude 3.5, Claude 3, and other Anthropic models",
  google: "Gemini 2.5 Pro, Gemini 2.0 Flash, and other Google models",
  xai: "Grok-3, Grok-2, and other xAI models",
  groq: "Llama 4, Mixtral, Gemma, and other Groq-hosted models",
  mistral: "Mistral Large, Mistral Medium, Codestral, and other Mistral models",
  deepseek: "DeepSeek-V3, DeepSeek-R1, and other DeepSeek models",
  ollama: "Self-hosted local models via Ollama",
  openrouter: "Unified access to 200+ models through OpenRouter",
  "azure-openai": "OpenAI models hosted on Azure (requires endpoint URL + API version)",
};

export function ProvidersSection() {
  const { data, isLoading } = useAiCredentials();
  const createCred = useCreateAiCredential();
  const updateCred = useUpdateAiCredential();
  const rotateCred = useRotateAiCredential();
  const testCred = useTestAiCredential();
  const deleteCred = useDeleteAiCredential();

  const [tab, setTab] = useState("all");

  const credentials = data?.items ?? [];

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createProvider, setCreateProvider] =
    useState<AIProviderName>("openai");
  const [createLabel, setCreateLabel] = useState("");
  const [createApiKey, setCreateApiKey] = useState("");
  const [createBaseUrl, setCreateBaseUrl] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [creating, setCreating] = useState(false);

  // Rotate dialog
  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotateTarget, setRotateTarget] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [rotateKey, setRotateKey] = useState("");
  const [rotating, setRotating] = useState(false);
  const [showRotateKey, setShowRotateKey] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{
    id: string;
    label: string;
    baseUrl: string;
    status: string;
  } | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editBaseUrl, setEditBaseUrl] = useState("");
  const [editStatus, setEditStatus] = useState("ACTIVE");

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    label: string;
  } | null>(null);

  async function handleCreate() {
    if (!createApiKey.trim()) {
      toast.error("API key is required");
      return;
    }
    setCreating(true);
    try {
      await createCred.mutateAsync({
        provider: createProvider,
        apiKey: createApiKey,
        label: createLabel.trim() || undefined,
        baseUrl: createBaseUrl.trim() || undefined,
      });
      toast.success(`${PROVIDER_LABELS[createProvider]} credential saved`);
      setCreateOpen(false);
      setCreateApiKey("");
      setCreateLabel("");
      setCreateBaseUrl("");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    } finally {
      setCreating(false);
    }
  }

  async function handleRotate() {
    if (!rotateTarget || !rotateKey.trim()) {
      toast.error("New API key is required");
      return;
    }
    setRotating(true);
    try {
      await rotateCred.mutateAsync({
        id: rotateTarget.id,
        apiKey: rotateKey,
      });
      toast.success("API key rotated");
      setRotateOpen(false);
      setRotateKey("");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    } finally {
      setRotating(false);
    }
  }

  async function handleEdit() {
    if (!editTarget) return;
    try {
      await updateCred.mutateAsync({
        id: editTarget.id,
        label: editLabel || undefined,
        baseUrl: editBaseUrl || undefined,
        status: editStatus as "ACTIVE" | "DISABLED",
      });
      toast.success("Credential updated");
      setEditOpen(false);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handleTest(id: string) {
    try {
      const result = await testCred.mutateAsync(id);
      if (result.status === "ok") {
        toast.success("Connection successful");
      } else {
        toast.error(`Connection failed: ${result.message}`);
      }
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteCred.mutateAsync(deleteTarget.id);
      toast.success("Credential deleted");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  const filtered =
    tab === "all"
      ? credentials
      : credentials.filter((c) => c.provider === tab);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">AI Providers</h2>
          <p className="text-sm text-muted-foreground">
            Manage API keys and provider configurations.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Add credential
        </Button>
      </div>

      {/* Provider filter tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">All</TabsTrigger>
          {[
            "openai",
            "anthropic",
            "google",
            "openrouter",
            "azure-openai",
            "ollama",
          ].map((p) => (
            <TabsTrigger key={p} value={p} className="capitalize">
              {PROVIDER_LABELS[p as AIProviderName]}
            </TabsTrigger>
          ))}
          <TabsTrigger value="other">Other</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <EmptyState
              icon={Key}
              title={
                tab === "all"
                  ? "No credentials configured"
                  : `No ${PROVIDER_LABELS[tab as AIProviderName] ?? tab} credentials`
              }
              description="Add an API key to start using this AI provider."
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    setCreateProvider(tab === "all" ? "openai" : (tab as AIProviderName));
                    setCreateOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Add credential
                </Button>
              }
            />
          )}

          {!isLoading && filtered.length > 0 && (
            <div className="grid gap-3">
              {filtered.map((cred) => (
                <Card key={cred.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-xs font-bold uppercase">
                          {cred.provider.slice(0, 2)}
                        </div>
                        <div>
                          <CardTitle className="text-sm flex items-center gap-2">
                            {PROVIDER_LABELS[cred.provider] ?? cred.provider}
                            {cred.label && (
                              <span className="text-xs text-muted-foreground font-normal">
                                {cred.label}
                              </span>
                            )}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {cred.maskedApiKey}
                            {cred.baseUrl && (
                              <>
                                {" · "}
                                <span
                                  className="truncate max-w-[200px] inline-block align-bottom"
                                  title={cred.baseUrl}
                                >
                                  {cred.baseUrl}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant={
                            cred.status === "ACTIVE"
                              ? "success"
                              : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {cred.status}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditTarget({
                                  id: cred.id,
                                  label: cred.label,
                                  baseUrl: cred.baseUrl ?? "",
                                  status: cred.status,
                                });
                                setEditLabel(cred.label);
                                setEditBaseUrl(cred.baseUrl ?? "");
                                setEditStatus(cred.status);
                                setEditOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleTest(cred.id)}
                              disabled={testCred.isPending}
                            >
                              <TestTube className="h-4 w-4" />
                              Test connection
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setRotateTarget({
                                  id: cred.id,
                                  label: `${PROVIDER_LABELS[cred.provider]}${cred.label ? ` (${cred.label})` : ""}`,
                                });
                                setRotateKey("");
                                setRotateOpen(true);
                              }}
                            >
                              <RefreshCw className="h-4 w-4" />
                              Rotate key
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() =>
                                setDeleteTarget({
                                  id: cred.id,
                                  label: `${PROVIDER_LABELS[cred.provider]}${cred.label ? ` (${cred.label})` : ""}`,
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {cred.lastTestStatus && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {cred.lastTestStatus === "ok" ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-500" />
                        )}
                        <span>
                          Last test:{" "}
                          {cred.lastTestStatus === "ok"
                            ? "passed"
                            : `failed${cred.lastTestError ? ` — ${cred.lastTestError}` : ""}`}
                        </span>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {PROVIDER_DESCRIPTIONS[cred.provider]}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add provider credential</DialogTitle>
            <DialogDescription>
              Your API key is encrypted at rest and never exposed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select
                value={createProvider}
                onValueChange={(v) =>
                  setCreateProvider(v as AIProviderName)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_PROVIDER_NAMES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PROVIDER_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Label (optional)</Label>
              <Input
                value={createLabel}
                onChange={(e) => setCreateLabel(e.target.value)}
                placeholder="production"
              />
            </div>
            <div className="space-y-2">
              <Label>API key</Label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={createApiKey}
                  onChange={(e) => setCreateApiKey(e.target.value)}
                  placeholder={
                    createProvider === "azure-openai"
                      ? "Your Azure OpenAI key"
                      : createProvider === "ollama"
                        ? "Optional (leave blank for local)"
                        : "sk-..."
                  }
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Stored encrypted. Never visible again after saving.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Base URL (optional)</Label>
              <Input
                value={createBaseUrl}
                onChange={(e) => setCreateBaseUrl(e.target.value)}
                placeholder={
                  createProvider === "azure-openai"
                    ? "https://my-resource.openai.azure.com"
                    : createProvider === "ollama"
                      ? "http://localhost:11434"
                      : "Custom API endpoint"
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} isLoading={creating}>
              Save credential
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rotate dialog */}
      <Dialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rotate API key</DialogTitle>
            <DialogDescription>
              {rotateTarget?.label} — the old key will be replaced immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>New API key</Label>
            <div className="relative">
              <Input
                type={showRotateKey ? "text" : "password"}
                value={rotateKey}
                onChange={(e) => setRotateKey(e.target.value)}
                placeholder="New API key"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowRotateKey(!showRotateKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showRotateKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRotateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRotate} isLoading={rotating}>
              Rotate key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit credential</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Base URL</Label>
              <Input
                value={editBaseUrl}
                onChange={(e) => setEditBaseUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={editStatus}
                onValueChange={setEditStatus}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="DISABLED">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete credential</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {deleteTarget?.label}? This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              isLoading={deleteCred.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
