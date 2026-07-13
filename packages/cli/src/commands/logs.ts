import { buildClient } from "../client.js";
import { TERMINAL_RUN_STATUSES, WorkflowsApi, type WorkflowLog } from "../workflows-api.js";

export interface LogsOptions {
  follow?: boolean;
  pollIntervalMs?: number;
}

function printLog(log: WorkflowLog): void {
  console.log(`[${log.createdAt}] ${log.level.padEnd(5)} ${log.event}: ${log.message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Prints every log for a run, then — with --follow — polls for new ones
 * (and the run's own status) until it reaches a terminal state. Uses
 * simple polling rather than the backend's SSE run stream
 * (POST /workflows/:id/run/stream): the plan explicitly allows either, and
 * polling a plain JSON endpoint is far simpler for a CLI to consume
 * correctly than parsing an event stream.
 *
 * Pagination note: with offset pagination, a growing log stream keeps
 * landing on the same `page` number until that page fills to `limit`, at
 * which point the next page becomes the new tail — so re-polling the same
 * page number (and only printing the items past what was already printed
 * from it) is what correctly surfaces newly-appended logs, not advancing
 * the page on every poll.
 */
export async function logs(runId: string, options: LogsOptions = {}): Promise<void> {
  const workflowsApi = new WorkflowsApi(buildClient());
  const pollIntervalMs = options.pollIntervalMs ?? 2000;
  const limit = 100;

  let page = 1;
  let printedInCurrentPage = 0;

  while (true) {
    const result = await workflowsApi.getLogs(runId, { page, limit });
    for (const log of result.items.slice(printedInCurrentPage)) {
      printLog(log);
    }
    printedInCurrentPage = result.items.length;

    if (result.items.length >= limit) {
      page += 1;
      printedInCurrentPage = 0;
      continue; // more full pages may already exist — keep draining before polling
    }

    if (!options.follow) return;

    const run = await workflowsApi.getRun(runId);
    if (TERMINAL_RUN_STATUSES.includes(run.status)) {
      console.log(`Run ${run.status.toLowerCase()}.`);
      return;
    }

    await sleep(pollIntervalMs);
  }
}
