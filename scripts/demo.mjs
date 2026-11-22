#!/usr/bin/env node

import { buildRouter } from "../app/build.mjs";
import { loadConfig } from "../config.mjs";
import { StaticStatusProvider } from "../status/provider.mjs";

const now = new Date().toISOString();
const statusProvider = new StaticStatusProvider({
  available: true,
  stale: false,
  ageMs: 0,
  value: {
    schema_version: 1,
    updated_at: now,
    zone: { id: 107, name: "South Gustaberg" },
    objective: "Safely test the chat companion",
    job: { name: "Monk", level: 3 },
    health_status: "healthy",
    recent_action: "observing a nearby Huge Hornet",
    reason: "the target passed the bounded safety checks",
  },
});
// Use fixture defaults, not the live service configuration.
const config = loadConfig({
  DRY_RUN: "true",
  AI_ENABLED: "false",
  STATUS_SOURCE: "none",
});
const router = await buildRouter(config, { statusProvider });

for (const [index, text] of [
  "!help",
  "!status",
  "!zone",
  "!why",
  "!project",
  "@Kupobot How does reactive combat work?",
].entries()) {
  const reply = await router.route({
    id: `demo-${index}`,
    authorChannelId: `demo-viewer-${index}`,
    text,
    publishedAt: now,
  });
  console.log(`viewer> ${text}`);
  console.log(`bot> ${reply?.text || "(no reply)"}`);
}
