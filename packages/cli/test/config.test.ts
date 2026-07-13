import assert from "node:assert/strict";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

// config.ts resolves ~/.voltx/credentials from os.homedir() at module load
// time, so HOME must be redirected to a scratch directory *before* the
// module is first imported — hence the dynamic import below rather than a
// static one.
let tempHome: string;
let config: typeof import("../src/config.js");

before(async () => {
  tempHome = mkdtempSync(join(tmpdir(), "voltx-cli-test-"));
  process.env.HOME = tempHome;
  config = await import("../src/config.js");
});

after(() => {
  rmSync(tempHome, { recursive: true, force: true });
});

describe("credentials storage", () => {
  it("returns null when no credentials file exists", () => {
    assert.equal(config.readCredentials(), null);
  });

  it("writes credentials with 0600 permissions and reads them back", () => {
    config.writeCredentials({
      baseUrl: "https://api.test/api/v1",
      organizationId: "org-1",
      personalAccessToken: "vpat_test",
    });

    const stats = statSync(config.credentialsPath());
    assert.equal(stats.mode & 0o777, 0o600);

    const read = config.readCredentials();
    assert.deepEqual(read, {
      baseUrl: "https://api.test/api/v1",
      organizationId: "org-1",
      personalAccessToken: "vpat_test",
    });
  });

  it("readCredentialsOrThrow throws a helpful error when logged out", () => {
    config.clearCredentials();
    assert.throws(() => config.readCredentialsOrThrow(), /voltx login/);
  });

  it("clearCredentials removes the file", () => {
    config.writeCredentials({
      baseUrl: "https://api.test/api/v1",
      organizationId: "org-1",
      personalAccessToken: "vpat_test",
    });
    config.clearCredentials();
    assert.equal(config.readCredentials(), null);
  });
});
