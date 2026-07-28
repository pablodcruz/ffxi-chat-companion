import assert from "node:assert/strict";
import test from "node:test";
import { buildRouter } from "../app/build.mjs";
import { loadConfig } from "../config.mjs";
import { StaticStatusProvider } from "../status/provider.mjs";
import { LiveChatPoller } from "../youtube/poller.mjs";

test("offline full flow routes commands and mentions through the posting boundary", async () => {
  const config = loadConfig({
    DRY_RUN: "false",
    AI_ENABLED: "false",
    YOUTUBE_CLIENT_ID: "client",
    YOUTUBE_CLIENT_SECRET: "secret",
    YOUTUBE_REFRESH_TOKEN: "refresh",
    YOUTUBE_BOT_CHANNEL_ID: "bot-channel",
  });
  const statusProvider = new StaticStatusProvider({
    available: true,
    stale: false,
    ageMs: 0,
    value: {
      schema_version: 1,
      updated_at: "2026-07-28T12:00:00.000Z",
      zone: { id: 107, name: "South Gustaberg" },
      objective: "Test the complete chat flow",
      job: { name: "Monk", level: 3 },
      health_status: "healthy",
      recent_action: "observing",
      reason: "validating the companion",
    },
  });
  const router = await buildRouter(config, {
    approvedKnowledge: "Approved test knowledge.",
    statusProvider,
    answerer: {
      async answer({ question }) {
        assert.equal(question, "What are we doing?");
        return "We are validating the safe chat flow, kupo!";
      },
    },
  });
  const pages = [
    {
      messages: [{
        id: "history",
        authorChannelId: "viewer-history",
        text: "!help",
        publishedAt: "2026-07-28T11:59:00.000Z",
      }],
      nextPageToken: "next-1",
      pollingIntervalMillis: 1_000,
      offlineAt: null,
    },
    {
      messages: [
        {
          id: "command",
          authorChannelId: "viewer-command",
          text: "!status",
          publishedAt: "2026-07-28T12:00:01.000Z",
        },
        {
          id: "mention",
          authorChannelId: "viewer-mention",
          text: "@Kupobot What are we doing?",
          publishedAt: "2026-07-28T12:00:02.000Z",
        },
      ],
      nextPageToken: "next-2",
      pollingIntervalMillis: 1_000,
      offlineAt: null,
    },
  ];
  const posted = [];
  const poller = new LiveChatPoller({
    liveChatId: "live-chat",
    router,
    logger: { info() {}, error() {} },
    clock: () => Date.parse("2026-07-28T12:00:00.000Z"),
    youtube: {
      async listMessages() {
        return pages.shift();
      },
      async postMessage(message) {
        posted.push(message);
        return { dryRun: false, id: `sent-${posted.length}` };
      },
    },
  });

  await poller.pollOnce();
  await poller.pollOnce();

  assert.equal(posted.length, 2);
  assert.match(posted[0].text, /Test the complete chat flow/u);
  assert.equal(posted[1].text, "We are validating the safe chat flow, kupo!");
  assert.ok(posted.every((message) => message.liveChatId === "live-chat"));
});
