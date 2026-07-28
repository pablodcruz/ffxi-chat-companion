import assert from "node:assert/strict";
import test from "node:test";
import { LiveChatPoller } from "../youtube/poller.mjs";

test("poller drops startup history and handles only later unseen messages", async () => {
  const pages = [
    {
      messages: [{
        id: "old",
        authorChannelId: "viewer-old",
        text: "!help",
        publishedAt: "2026-07-28T11:59:00Z",
      }],
      nextPageToken: "page-2",
      pollingIntervalMillis: 1_000,
      offlineAt: null,
    },
    {
      messages: [{
        id: "new",
        authorChannelId: "viewer-new",
        text: "!status",
        publishedAt: "2026-07-28T12:00:01Z",
      }],
      nextPageToken: "page-3",
      pollingIntervalMillis: 1_000,
      offlineAt: null,
    },
  ];
  const posted = [];
  const routed = [];
  const poller = new LiveChatPoller({
    liveChatId: "chat",
    clock: () => Date.parse("2026-07-28T12:00:00Z"),
    youtube: {
      async listMessages() { return pages.shift(); },
      async postMessage(message) {
        posted.push(message);
        return { dryRun: true };
      },
    },
    router: {
      async route(message) {
        routed.push(message.id);
        return { kind: "command", text: "safe reply" };
      },
    },
    logger: { info() {}, error() {} },
  });
  await poller.pollOnce();
  await poller.pollOnce();
  assert.deepEqual(routed, ["new"]);
  assert.equal(posted.length, 1);
  assert.equal(posted[0].liveChatId, "chat");
});
