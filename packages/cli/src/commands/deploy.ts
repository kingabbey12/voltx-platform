import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { parse as parseYaml } from "yaml";
import { buildClient } from "../client.js";
import { WorkflowsApi, type WorkflowDefinition } from "../workflows-api.js";

interface WorkflowManifest {
  workflowId?: string;
  name?: string;
  description?: string;
  definition: WorkflowDefinition;
}

export interface DeployOptions {
  workflowId?: string;
  name?: string;
  description?: string;
  publish?: boolean;
}

function loadManifest(filePath: string): WorkflowManifest {
  const raw = readFileSync(filePath, "utf8");
  const isYaml = extname(filePath) === ".yaml" || extname(filePath) === ".yml";
  const parsed = (isYaml ? parseYaml(raw) : JSON.parse(raw)) as Record<string, unknown>;

  // Accept either a full manifest ({ workflowId?, name?, description?,
  // definition }) or a bare workflow definition ({ steps: [...] }) —
  // in the latter case name/workflowId must come from CLI flags.
  if ("definition" in parsed) {
    return parsed as unknown as WorkflowManifest;
  }
  return { definition: parsed as WorkflowDefinition };
}

export async function deploy(filePath: string, options: DeployOptions): Promise<void> {
  const manifest = loadManifest(filePath);
  const workflowId = options.workflowId ?? manifest.workflowId;
  const name = options.name ?? manifest.name;
  const description = options.description ?? manifest.description;

  const client = buildClient();
  const workflowsApi = new WorkflowsApi(client);

  if (workflowId) {
    const workflow = await workflowsApi.update(workflowId, { name, description, definition: manifest.definition });
    console.log(`Deployed a new version of workflow "${workflow.name}" (${workflow.id}).`);
    if (options.publish) {
      await workflowsApi.publish(workflow.id);
      console.log("Published.");
    }
    return;
  }

  if (!name) {
    throw new Error(
      "A workflow name is required to create a new workflow — pass --name, or include \"name\" in the manifest, " +
        "or pass --workflow-id to deploy a new version of an existing workflow instead.",
    );
  }

  const workflow = await workflowsApi.create({ name, description, definition: manifest.definition });
  console.log(`Created workflow "${workflow.name}" (${workflow.id}).`);
  if (options.publish) {
    await workflowsApi.publish(workflow.id);
    console.log("Published.");
  }
}
