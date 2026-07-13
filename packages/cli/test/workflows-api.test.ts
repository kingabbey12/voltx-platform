import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { VoltxClient } from "@voltx/sdk";
import { WorkflowsApi } from "../src/workflows-api.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function makeWorkflowsApi(fetchMock: typeof fetch) {
  const client = new VoltxClient({
    baseUrl: "https://api.test/api/v1",
    auth: { mode: "personal-access-token", token: "vpat_test", organizationId: "org-1" },
    fetch: fetchMock,
  });
  return new WorkflowsApi(client);
}

describe("WorkflowsApi", () => {
  it("create POSTs to /workflows with the manifest fields", async () => {
    const fetchMock = mock.fn(async () =>
      jsonResponse(201, {
        success: true,
        data: {
          id: "wf-1",
          name: "Deploy Test",
          description: null,
          status: "DRAFT",
          publishedVersion: null,
          createdBy: "user-1",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        meta: {},
      }),
    );
    const workflowsApi = makeWorkflowsApi(fetchMock as unknown as typeof fetch);

    const workflow = await workflowsApi.create({ name: "Deploy Test", definition: { steps: [] } });

    assert.equal(workflow.id, "wf-1");
    const [url, init] = fetchMock.mock.calls[0].arguments as [string, RequestInit];
    assert.equal(url, "https://api.test/api/v1/workflows");
    assert.equal(init.method, "POST");
    assert.deepEqual(JSON.parse(init.body as string), { name: "Deploy Test", definition: { steps: [] } });
  });

  it("update PATCHes /workflows/:id (creating a new version)", async () => {
    const fetchMock = mock.fn(async () =>
      jsonResponse(200, {
        success: true,
        data: {
          id: "wf-1",
          name: "Deploy Test",
          description: null,
          status: "DRAFT",
          publishedVersion: null,
          createdBy: "user-1",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
        meta: {},
      }),
    );
    const workflowsApi = makeWorkflowsApi(fetchMock as unknown as typeof fetch);

    await workflowsApi.update("wf-1", { definition: { steps: [{ id: "a" }] } });

    const [url, init] = fetchMock.mock.calls[0].arguments as [string, RequestInit];
    assert.equal(url, "https://api.test/api/v1/workflows/wf-1");
    assert.equal(init.method, "PATCH");
  });

  it("run POSTs to /workflows/:id/run and returns the new run", async () => {
    const fetchMock = mock.fn(async () =>
      jsonResponse(201, {
        success: true,
        data: {
          id: "run-1",
          workflowId: "wf-1",
          workflowVersionId: "version-1",
          status: "PENDING",
          currentStepId: null,
          error: null,
          startedAt: null,
          completedAt: null,
          durationMs: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        meta: {},
      }),
    );
    const workflowsApi = makeWorkflowsApi(fetchMock as unknown as typeof fetch);

    const run = await workflowsApi.run("wf-1", { input: { dealId: "123" } });

    assert.equal(run.id, "run-1");
    const [url, init] = fetchMock.mock.calls[0].arguments as [string, RequestInit];
    assert.equal(url, "https://api.test/api/v1/workflows/wf-1/run");
    assert.deepEqual(JSON.parse(init.body as string), { input: { dealId: "123" } });
  });

  it("getLogs GETs /workflows/runs/:runId/logs with pagination query params", async () => {
    const fetchMock = mock.fn(async () =>
      jsonResponse(200, { success: true, data: { items: [], total: 0, page: 2, limit: 100 }, meta: {} }),
    );
    const workflowsApi = makeWorkflowsApi(fetchMock as unknown as typeof fetch);

    await workflowsApi.getLogs("run-1", { page: 2, limit: 100 });

    const [url] = fetchMock.mock.calls[0].arguments as [string, RequestInit];
    assert.equal(url, "https://api.test/api/v1/workflows/runs/run-1/logs?page=2&limit=100");
  });
});
