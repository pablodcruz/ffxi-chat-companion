#!/usr/bin/env node

import { loadConfig, validateYouTubeRuntimeConfig } from "../config.mjs";
import { YouTubeLiveClient } from "../youtube/client.mjs";
import { inspectYouTubeReadPath } from "../youtube/doctor.mjs";
import { GoogleRefreshTokenProvider } from "../youtube/oauth.mjs";

const config = loadConfig();
validateYouTubeRuntimeConfig(config);
const oauth = new GoogleRefreshTokenProvider(config.youtube);
const youtube = new YouTubeLiveClient({
  accessTokenProvider: oauth,
  dryRun: true,
});
const result = await inspectYouTubeReadPath({
  youtube,
  configuredLiveChatId: config.youtube.liveChatId,
});

console.log(JSON.stringify(result, null, 2));
