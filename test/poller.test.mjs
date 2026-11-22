import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
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
    {
      messages: [{
        id: "bot-sent",
        authorChannelId: "incorrectly-configured-bot-channel",
        text: "@Kupobot try !help",
        publishedAt: "2026-07-28T12:00:02Z",
      }],
      nextPageToken: "page-4",
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
        return { dryRun: false, id: "bot-sent" };
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
  await poller.pollOnce();
  assert.deepEqual(routed, ["new"]);
  assert.equal(posted.length, 1);
  assert.equal(posted[0].liveChatId, "chat");
});

function fakePoller(listMessages) {
  return new LiveChatPoller({
    liveChatId: "synthetic",
    youtube: { listMessages },
    router: { async route() { throw new Error("No message should be routed"); } },
    logger: { info() {}, error() {} },
  });
}

const syntheticPage = (last = false, delay = 0) => ({
  messages: [], nextPageToken: null, pollingIntervalMillis: delay,
  offlineAt: last ? "2026-07-28T12:00:00Z" : null,
});

test("eight polls leave no abort listeners on normal completion", async () => {
  const controller = new AbortController();
  let polls = 0;
  const poller = fakePoller(async () => syntheticPage(++polls === 8));
  await poller.run({ signal: controller.signal });
  assert.equal(polls, 8);
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
});

test("abort during delay rejects once, removes its listener, and never polls again", async () => {
  const controller = new AbortController();
  const reason = new Error("Synthetic interruption");
  let polls = 0;
  const poller = fakePoller(async () => { polls++; return syntheticPage(false, 10_000); });
  const run = poller.run({ signal: controller.signal });
  const stopped = assert.rejects(run, (error) => error === reason);
  await new Promise(setImmediate);
  assert.equal(getEventListeners(controller.signal, "abort").length, 1);
  controller.abort(reason);
  await stopped;
  assert.equal(polls, 1);
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
});

test("if a poll finishes after interruption, the delay immediately rejects", async () => {
  const controller = new AbortController();
  const reason = new Error("Synthetic interruption during the poll");
  let polls = 0;
  const poller = fakePoller(async () => {
    polls++;
    controller.abort(reason);
    return syntheticPage();
  });
  await assert.rejects(poller.run({ signal: controller.signal }), (error) => error === reason);
  assert.equal(polls, 1);
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
});

test("a recovered transient backoff leaves no abort listener", async () => {
  const controller = new AbortController();
  let polls = 0;
  const poller = fakePoller(async () => {
    if (++polls === 1) throw new Error("Synthetic transient failure");
    return syntheticPage(true);
  });
  await poller.run({ signal: controller.signal });
  assert.equal(polls, 2);
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
});
