import { VoltxClient } from "@voltx/sdk";
import { readCredentialsOrThrow } from "./config.js";

export function buildClient(): VoltxClient {
  const credentials = readCredentialsOrThrow();
  return new VoltxClient({
    baseUrl: credentials.baseUrl,
    auth: {
      mode: "personal-access-token",
      token: credentials.personalAccessToken,
      organizationId: credentials.organizationId,
    },
  });
}
