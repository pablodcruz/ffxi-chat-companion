#!/usr/bin/env node

import process from "node:process";
import { buildRouter } from "./build.mjs";
import { loadConfig, validateYouTubeRuntimeConfig } from "../config.mjs";
import { createLogger } from "../logging/logger.mjs";
import { YouTubeLiveClient } from "../youtube/client.mjs";
import { GoogleRefreshTokenProvider } from "../youtube/oauth.mjs";
import { LiveChatPoller } from "../youtube/poller.mjs";

const config = loadConfig();
validateYouTubeRuntimeConfig(config);
const logger = createLogger();
const oauth = new GoogleRefreshTokenProvider(config.youtube);
const youtube = new YouTubeLiveClient({
  accessTokenProvider: oauth,
  dryRun: config.dryRun,
});
const liveChatId =
  config.youtube.liveChatId || await youtube.findActiveLiveChatId();
const router = await buildRouter(config);
const poller = new LiveChatPoller({ youtube, liveChatId, router, logger });
const controller = new AbortController();

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => controller.abort(new Error(`${signal} received.`)));
}

logger.info({
  event: "started",
  dry_run: config.dryRun,
  status_source: config.status.source,
});
await poller.run({ signal: controller.signal }).catch((error) => {
  if (!controller.signal.aborted) throw error;
});
