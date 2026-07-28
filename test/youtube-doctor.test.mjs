import assert from "node:assert/strict";
import test from "node:test";
import { inspectYouTubeReadPath } from "../youtube/doctor.mjs";

test("YouTube doctor discovers and reads chat without returning identifiers or text", async () => {
  let discoveryCalls = 0;
  let listArgument;
  const result = await inspectYouTubeReadPath({
    youtube: {
      async findActiveLiveChatId() {
        discoveryCalls += 1;
        return "private-chat-id";
      },
      async listMessages(argument) {
        listArgument = argument;
        return {
          messages: [{
            id: "private-message-id",
            authorChannelId: "private-viewer-id",
            text: "private message text",
          }],
          nextPageToken: "private-page-token",
          pollingIntervalMillis: 8_000,
          offlineAt: null,
        };
      },
    },
  });

  assert.equal(discoveryCalls, 1);
  assert.deepEqual(listArgument, { liveChatId: "private-chat-id" });
  assert.deepEqual(result, {
    ok: true,
    active_chat_found: true,
    chat_is_live: true,
    text_messages_observed: 1,
    polling_interval_ms: 8_000,
    continuation_available: true,
  });
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /private/u);
});

test("YouTube doctor honors a configured chat ID without discovery", async () => {
  const result = await inspectYouTubeReadPath({
    configuredLiveChatId: "configured-chat",
    youtube: {
      async findActiveLiveChatId() {
        throw new Error("discovery must not run");
      },
      async listMessages({ liveChatId }) {
        assert.equal(liveChatId, "configured-chat");
        return {
          messages: [],
          nextPageToken: null,
          pollingIntervalMillis: 5_000,
          offlineAt: "2026-07-28T12:00:00.000Z",
        };
      },
    },
  });
  assert.equal(result.chat_is_live, false);
  assert.equal(result.continuation_available, false);
});
