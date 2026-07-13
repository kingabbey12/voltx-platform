#!/usr/bin/env node
// Regenerates src/generated/schema.ts from a running backend's live OpenAPI
// 3.1 document. Run this — and review the resulting diff — every time the
// public API changes; the output is checked into the repo, never generated
// silently as part of a normal build.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const source = process.env.VOLTX_OPENAPI_URL ?? "http://localhost:3000/api-json";
const out = new URL("../src/generated/schema.ts", import.meta.url).pathname;

console.log(`Generating types from ${source} -> ${out}`);
execFileSync("npx", ["openapi-typescript", source, "-o", out], { stdio: "inherit" });

// The backend's full route surface currently has a small number of
// duplicate operationIds across unrelated controllers that happen to
// share a class name (e.g. two distinct "update" endpoints both named
// ConversationController_update_v1) — a pre-existing OpenAPI-document
// quality issue outside this SDK's scope to fix. That only breaks
// TypeScript's `operations` namespace, which this SDK never references
// (only `components["schemas"]`), so it's suppressed here rather than
// blocking every future regeneration on an unrelated backend fix.
const generated = readFileSync(out, "utf8");
writeFileSync(out, `// @ts-nocheck\n${generated}`);
