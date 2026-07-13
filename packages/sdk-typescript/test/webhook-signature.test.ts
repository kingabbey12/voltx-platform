import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { verifyWebhookSignature } from "../src/webhook-signature.js";

describe("verifyWebhookSignature", () => {
  const secret = "whsec_test_secret";
  const rawBody = JSON.stringify({ eventType: "sales.lead.created", payload: { id: "1" } });

  function sign(body: string, withSecret = secret): string {
    return `sha256=${createHmac("sha256", withSecret).update(body).digest("hex")}`;
  }

  it("accepts a correctly signed payload", () => {
    assert.equal(verifyWebhookSignature(secret, rawBody, sign(rawBody)), true);
  });

  it("rejects a signature computed with the wrong secret", () => {
    assert.equal(verifyWebhookSignature(secret, rawBody, sign(rawBody, "wrong-secret")), false);
  });

  it("rejects a tampered body", () => {
    const tampered = JSON.stringify({ eventType: "sales.lead.created", payload: { id: "2" } });
    assert.equal(verifyWebhookSignature(secret, tampered, sign(rawBody)), false);
  });

  it("rejects a malformed signature header", () => {
    assert.equal(verifyWebhookSignature(secret, rawBody, "not-a-signature"), false);
  });
});
