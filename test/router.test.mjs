import assert from "node:assert/strict";
import test from "node:test";
import { ChatRouter } from "../bot/router.mjs";
import { createCommands } from "../commands/registry.mjs";
import { DuplicateSuppressor, ReplyRateLimiter } from "../safety/rate-limiter.mjs";
import { StaticStatusProvider } from "../status/provider.mjs";

function freshStatus() {
  return {
    available: true,
    stale: false,
    ageMs: 0,
    value: {
      schema_version: 1,
      updated_at: "2026-07-28T12:00:00.000Z",
      zone: { id: 107, name: "South Gustaberg" },
      objective: "Gain experience safely",
      job: { name: "Monk", level: 3 },
      health_status: "healthy",
      recent_action: "checking a target",
      reason: "it appears isolated and easy prey",
    },
  };
}

function router(overrides = {}) {
  return new ChatRouter({
    mentionAliases: ["Kupobot"],
    botChannelId: "bot-channel",
    commands: createCommands({
      botDisplayName: "Kupobot",
      projectUrl: "https://github.com/pablodcruz/ffxi-agents-server",
      companionUrl: "https://github.com/pablodcruz/ffxi-chat-companion",
    }),
    statusProvider: new StaticStatusProvider(freshStatus()),
    answerer: {
      async answer({ question }) {
        return `AI answer about ${question}, kupo!`;
      },
    },
    rateLimiter: new ReplyRateLimiter({
      viewerCooldownMs: 30_000,
      globalAiPerMinute: 3,
      globalRepliesPerMinute: 10,
    }),
    duplicateSuppressor: new DuplicateSuppressor({ windowMs: 20_000 }),
    maxInputChars: 500,
    maxReplyChars: 380,
    ...overrides,
  });
}

test("router ignores ordinary chat and its own channel", async () => {
  const subject = router();
  assert.equal(await subject.route({
    authorChannelId: "viewer",
    text: "hello chat",
  }), null);
  assert.equal(await subject.route({
    authorChannelId: "bot-channel",
    text: "!help",
  }), null);
});

test("router serves deterministic commands from sanitized status", async () => {
  const subject = router();
  const response = await subject.route({
    authorChannelId: "viewer",
    text: "!status",
  });
  assert.equal(response.kind, "command");
  assert.match(response.text, /Gain experience safely/u);
  assert.match(response.text, /checking a target/u);
});

test("router invokes AI only on a direct mention", async () => {
  let calls = 0;
  const subject = router({
    answerer: {
      async answer({ question }) {
        calls += 1;
        assert.equal(question, "How does reactive combat work?");
        return "It uses bounded checks and fail-closed stops, kupo!";
      },
    },
  });
  assert.equal(await subject.route({
    authorChannelId: "viewer-a",
    text: "How does reactive combat work?",
  }), null);
  const response = await subject.route({
    authorChannelId: "viewer-b",
    text: "@Kupobot How does reactive combat work?",
  });
  assert.equal(calls, 1);
  assert.equal(response.kind, "ai");
});

test("router applies viewer cooldown before a second eligible reply", async () => {
  const subject = router();
  assert.ok(await subject.route({
    authorChannelId: "viewer",
    text: "!zone",
  }));
  assert.equal(await subject.route({
    authorChannelId: "viewer",
    text: "!why",
  }), null);
});

test("status commands fail honestly when the feed is unavailable", async () => {
  const subject = router({
    statusProvider: new StaticStatusProvider({
      available: false,
      stale: false,
      reason: "not_configured",
      value: null,
    }),
  });
  const response = await subject.route({
    authorChannelId: "viewer",
    text: "!zone",
  });
  assert.match(response.text, /unavailable/u);
  assert.match(response.text, /without guessing/u);
});
