#!/usr/bin/env node
import { Command } from "commander";
import { deploy } from "./commands/deploy.js";
import { login } from "./commands/login.js";
import { logout } from "./commands/logout.js";
import { logs } from "./commands/logs.js";
import { whoami } from "./commands/whoami.js";
import { workflowsList, workflowsRun, workflowsShow } from "./commands/workflows.js";

const program = new Command();

program
  .name("voltx")
  .description("Official command-line tool for the Voltx public API")
  .version("0.1.0");

program
  .command("login")
  .description("Log in with a personal access token (create one at /developers/personal-access-tokens)")
  .argument("<token>", "a personal access token, e.g. vpat_...")
  .requiredOption("--organization-id <id>", "the organization to act in")
  .option("--base-url <url>", "API base URL", "https://api.usevoltx.com/api/v1")
  .action(async (token: string, opts: { organizationId: string; baseUrl: string }) => {
    await login(token, { baseUrl: opts.baseUrl, organizationId: opts.organizationId });
  });

program
  .command("logout")
  .description("Remove stored credentials")
  .action(() => logout());

program
  .command("whoami")
  .description("Show the organization and effective permissions for the current login")
  .action(async () => whoami());

program
  .command("deploy")
  .description("Deploy a local workflow-definition file as a new workflow (or a new version of one)")
  .argument("<file>", "path to a JSON or YAML workflow manifest/definition")
  .option("--workflow-id <id>", "deploy a new version of this existing workflow")
  .option("--name <name>", "workflow name (required when creating a new workflow)")
  .option("--description <description>", "workflow description")
  .option("--publish", "publish the resulting version immediately", false)
  .action(async (file: string, opts: { workflowId?: string; name?: string; description?: string; publish: boolean }) => {
    await deploy(file, opts);
  });

const workflows = program.command("workflows").description("List, inspect, and run workflows");

workflows
  .command("list")
  .description("List workflows")
  .action(async () => workflowsList());

workflows
  .command("show")
  .description("Show a workflow")
  .argument("<id>", "workflow id")
  .action(async (id: string) => workflowsShow(id));

workflows
  .command("run")
  .description("Start a workflow run")
  .argument("<id>", "workflow id")
  .option("--input <json>", "JSON input for the run")
  .action(async (id: string, opts: { input?: string }) => workflowsRun(id, opts.input));

program
  .command("logs")
  .description("Print (and optionally follow) a workflow run's logs")
  .argument("<runId>", "workflow run id")
  .option("-f, --follow", "keep polling until the run finishes", false)
  .action(async (runId: string, opts: { follow: boolean }) => logs(runId, { follow: opts.follow }));

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
