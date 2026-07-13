import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface VoltxCliCredentials {
  baseUrl: string;
  organizationId: string;
  personalAccessToken: string;
}

const CONFIG_DIR = join(homedir(), ".voltx");
const CREDENTIALS_PATH = join(CONFIG_DIR, "credentials");

export function readCredentials(): VoltxCliCredentials | null {
  if (!existsSync(CREDENTIALS_PATH)) return null;
  return JSON.parse(readFileSync(CREDENTIALS_PATH, "utf8")) as VoltxCliCredentials;
}

export function readCredentialsOrThrow(): VoltxCliCredentials {
  const credentials = readCredentials();
  if (!credentials) {
    throw new Error('Not logged in. Run "voltx login <personal-access-token>" first.');
  }
  return credentials;
}

/** Written with 0600 permissions — readable/writable only by the current
 * user, since this file holds a live bearer credential. */
export function writeCredentials(credentials: VoltxCliCredentials): void {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2), { mode: 0o600 });
}

export function clearCredentials(): void {
  if (existsSync(CREDENTIALS_PATH)) {
    rmSync(CREDENTIALS_PATH);
  }
}

export function credentialsPath(): string {
  return CREDENTIALS_PATH;
}
