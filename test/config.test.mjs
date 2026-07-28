import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig, validateYouTubeRuntimeConfig } from "../config.mjs";

test("configuration defaults fail closed", () => {
  const config = loadConfig({});
  assert.equal(config.dryRun, true);
  assert.equal(config.aiEnabled, false);
  assert.equal(config.openai.model, "gpt-5.6-luna");
  assert.equal(config.status.source, "none");
  assert.equal(config.limits.viewerCooldownMs, 45_000);
});

test("partial YouTube OAuth configuration is rejected", () => {
  assert.throws(
    () => loadConfig({ YOUTUBE_CLIENT_ID: "only-one-value" }),
    /must be configured together/u,
  );
});

test("live posting requires the bot channel ID", () => {
  assert.throws(
    () => loadConfig({ DRY_RUN: "false" }),
    /YOUTUBE_BOT_CHANNEL_ID/u,
  );
});

test("AI requires an API key and a strong hashing salt", () => {
  assert.throws(
    () => loadConfig({ AI_ENABLED: "true" }),
    /OPENAI_API_KEY/u,
  );
  assert.throws(
    () => loadConfig({
      AI_ENABLED: "true",
      OPENAI_API_KEY: "test-key",
      SAFETY_HASH_SALT: "short",
    }),
    /SAFETY_HASH_SALT/u,
  );
});

test("viewer cooldown cannot leave the requested 30-60 second range", () => {
  assert.throws(
    () => loadConfig({ VIEWER_COOLDOWN_SECONDS: "29" }),
    /30 through 60/u,
  );
  assert.throws(
    () => loadConfig({ VIEWER_COOLDOWN_SECONDS: "61" }),
    /30 through 60/u,
  );
});

test("service startup requires complete YouTube OAuth even in dry-run mode", () => {
  const config = loadConfig({});
  assert.throws(
    () => validateYouTubeRuntimeConfig(config),
    /YouTube service startup requires/u,
  );
  const configured = loadConfig({
    YOUTUBE_CLIENT_ID: "client",
    YOUTUBE_CLIENT_SECRET: "secret",
    YOUTUBE_REFRESH_TOKEN: "refresh",
  });
  assert.doesNotThrow(() => validateYouTubeRuntimeConfig(configured));
});
