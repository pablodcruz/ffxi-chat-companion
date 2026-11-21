#!/usr/bin/env node

import { buildRouter } from "../app/build.mjs";
import { loadConfig } from "../config.mjs";
import { StaticStatusProvider } from "../status/provider.mjs";
import { renderTranscript } from "./transcript.mjs";

const now = "2026-07-28T12:00:00.000Z";
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
const config = loadConfig({
  DRY_RUN: "true",
  AI_ENABLED: "false",
  STATUS_SOURCE: "none",
});
const router = await buildRouter(config, { statusProvider });
const messages = [];

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
  messages.push(
    { speaker: "Viewer", text },
    { speaker: "Kupobot", text: reply?.text || "(no reply)" },
  );
}

if (process.argv.includes("--html")) {
  console.log(renderTranscript(messages));
} else {
  for (const { speaker, text } of messages) {
    console.log(`${speaker === "Viewer" ? "viewer" : "bot"}> ${text}`);
  }
}
