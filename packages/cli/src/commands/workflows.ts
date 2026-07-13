import { buildClient } from "../client.js";
import { WorkflowsApi } from "../workflows-api.js";

export async function workflowsList(): Promise<void> {
  const workflowsApi = new WorkflowsApi(buildClient());
  const result = await workflowsApi.list({ limit: 100 });

  if (result.items.length === 0) {
    console.log("No workflows found.");
    return;
  }

  for (const workflow of result.items) {
    const published = workflow.publishedVersion ? `v${workflow.publishedVersion}` : "unpublished";
    console.log(`${workflow.id}  ${workflow.status.padEnd(9)}  ${published.padEnd(11)}  ${workflow.name}`);
  }
}

export async function workflowsShow(id: string): Promise<void> {
  const workflowsApi = new WorkflowsApi(buildClient());
  const workflow = await workflowsApi.get(id);
  console.log(JSON.stringify(workflow, null, 2));
}

export async function workflowsRun(id: string, inputJson?: string): Promise<void> {
  const workflowsApi = new WorkflowsApi(buildClient());
  const input = inputJson ? (JSON.parse(inputJson) as Record<string, unknown>) : undefined;
  const run = await workflowsApi.run(id, input ? { input } : undefined);
  console.log(`Started run ${run.id} (status: ${run.status}).`);
  console.log(`Tail logs with: voltx logs ${run.id} --follow`);
}
