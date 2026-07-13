import { clearCredentials, credentialsPath, readCredentials } from "../config.js";

export function logout(): void {
  if (!readCredentials()) {
    console.log("Not logged in.");
    return;
  }
  clearCredentials();
  console.log(`Removed credentials at ${credentialsPath()}.`);
}
