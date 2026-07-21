import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const envFile = resolve(process.cwd(), ".env.local");
const source = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
const configured = process.env.NEXT_PUBLIC_API_BASE_URL ?? source.match(/^NEXT_PUBLIC_API_BASE_URL=(.*)$/m)?.[1]?.trim();

if (!configured) {
  throw new Error(
    "NEXT_PUBLIC_API_BASE_URL is missing. Copy .env.example to .env.local and set it to the API URL (local Compose: http://localhost:3000/api/v1). See ENVIRONMENT.md.",
  );
}
