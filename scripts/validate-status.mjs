#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import process from "node:process";
import { parseStatusDocument } from "../status/provider.mjs";

const [file, ...unexpected] = process.argv.slice(2);
if (!file || unexpected.length > 0) {
  throw new Error("Usage: npm run status:validate -- /path/to/status.json");
}

try {
  const status = parseStatusDocument(await readFile(file, "utf8"));
  console.log(JSON.stringify({
    valid: true,
    schema_version: status.schema_version,
    updated_at: status.updated_at,
    health_status: status.health_status,
    fields: Object.keys(status),
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    valid: false,
    error: error instanceof Error ? error.message : "Unknown validation error.",
  }, null, 2));
  process.exitCode = 1;
}
