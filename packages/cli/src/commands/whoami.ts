import { buildClient } from "../client.js";

export async function whoami(): Promise<void> {
  const client = buildClient();
  const result = await client.get<{ organizationId: string; permissions: string[] }>(
    "/developer/personal-access-tokens/whoami",
  );
  console.log(`Organization: ${result.organizationId}`);
  console.log(`Permissions (${result.permissions.length}):`);
  for (const permission of result.permissions.sort()) {
    console.log(`  ${permission}`);
  }
}
