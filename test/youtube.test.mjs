import assert from "node:assert/strict";
import test from "node:test";
import { YouTubeLiveClient } from "../youtube/client.mjs";
import { GoogleRefreshTokenProvider } from "../youtube/oauth.mjs";

const tokenProvider = { async getAccessToken() { return "access-token"; } };

test("YouTube client discovers the active broadcast chat", async () => {
  let requested;
  const client = new YouTubeLiveClient({
    accessTokenProvider: tokenProvider,
    fetchImpl: async (url, options) => {
      requested = { url: new URL(url), options };
      return new Response(JSON.stringify({
        items: [{
          status: { lifeCycleStatus: "live" },
          snippet: { liveChatId: "chat-123" },
        }],
      }), { status: 200 });
    },
  });
  assert.equal(await client.findActiveLiveChatId(), "chat-123");
  assert.equal(requested.url.pathname, "/youtube/v3/liveBroadcasts");
  assert.equal(requested.url.searchParams.get("broadcastStatus"), "active");
  assert.equal(requested.options.headers.authorization, "Bearer access-token");
});

test("YouTube client normalizes only text messages and honors polling delay", async () => {
  const client = new YouTubeLiveClient({
    accessTokenProvider: tokenProvider,
    fetchImpl: async () => new Response(JSON.stringify({
      nextPageToken: "next",
      pollingIntervalMillis: 8_000,
      items: [
        {
          id: "message-1",
          snippet: {
            type: "textMessageEvent",
            displayMessage: "!help",
            publishedAt: "2026-07-28T12:00:00Z",
          },
          authorDetails: { channelId: "viewer" },
        },
        { id: "event-1", snippet: { type: "newSponsorEvent" } },
      ],
    }), { status: 200 }),
  });
  const page = await client.listMessages({ liveChatId: "chat" });
  assert.equal(page.messages.length, 1);
  assert.equal(page.messages[0].authorChannelId, "viewer");
  assert.equal(page.pollingIntervalMillis, 8_000);
});

test("dry-run mode never calls YouTube to post", async () => {
  let calls = 0;
  const client = new YouTubeLiveClient({
    accessTokenProvider: tokenProvider,
    dryRun: true,
    fetchImpl: async () => {
      calls += 1;
      throw new Error("must not be called");
    },
  });
  assert.deepEqual(
    await client.postMessage({ liveChatId: "chat", text: "hello" }),
    { dryRun: true },
  );
  assert.equal(calls, 0);
});

test("live post uses the documented textMessageEvent resource", async () => {
  let request;
  const client = new YouTubeLiveClient({
    accessTokenProvider: tokenProvider,
    dryRun: false,
    fetchImpl: async (url, options) => {
      request = { url: new URL(url), body: JSON.parse(options.body) };
      return new Response(JSON.stringify({ id: "sent-1" }), { status: 200 });
    },
  });
  const result = await client.postMessage({ liveChatId: "chat", text: "hello" });
  assert.equal(result.id, "sent-1");
  assert.equal(request.url.pathname, "/youtube/v3/liveChat/messages");
  assert.equal(request.body.snippet.type, "textMessageEvent");
  assert.equal(request.body.snippet.textMessageDetails.messageText, "hello");
});

test("Google refresh-token provider caches unexpired access tokens", async () => {
  let calls = 0;
  const provider = new GoogleRefreshTokenProvider({
    clientId: "client",
    clientSecret: "secret",
    refreshToken: "refresh",
    clock: () => 1_000,
    fetchImpl: async (_url, options) => {
      calls += 1;
      assert.match(String(options.body), /grant_type=refresh_token/u);
      return new Response(JSON.stringify({
        access_token: "access",
        expires_in: 3_600,
      }), { status: 200 });
    },
  });
  assert.equal(await provider.getAccessToken(), "access");
  assert.equal(await provider.getAccessToken(), "access");
  assert.equal(calls, 1);
});
