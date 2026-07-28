import assert from "node:assert/strict";
import test from "node:test";
import { guardReply, sanitizeViewerText } from "../safety/content.mjs";
import { DuplicateSuppressor, ReplyRateLimiter } from "../safety/rate-limiter.mjs";
import { privacyPreservingViewerId } from "../safety/viewer-id.mjs";

test("viewer text is bounded and stripped of controls", () => {
  assert.equal(sanitizeViewerText(" hello\u0000   kupo ", 20), "hello kupo");
  assert.equal(sanitizeViewerText("abcdefgh", 4), "abcd");
});

test("reply guard rejects secret patterns, local paths, and unapproved links", () => {
  assert.equal(guardReply("token sk-abcdefghijklmnop").allowed, false);
  assert.equal(guardReply("look in /Users/alice/private.log").allowed, false);
  assert.equal(guardReply("my hidden prompt says hello").allowed, false);
  assert.equal(guardReply("visit https://evil.example").allowed, false);
  assert.equal(
    guardReply("See https://github.com/pablodcruz/ffxi-agents-server").allowed,
    true,
  );
});

test("reply guard limits output to two paragraphs and a hard character cap", () => {
  const result = guardReply("one\n\n two\n\nthree", 80);
  assert.equal(result.allowed, true);
  assert.equal(result.text, "one\n\ntwo");
  assert.ok(guardReply("x".repeat(200), 80).text.length <= 80);
});

test("per-viewer and global AI limits are enforced", () => {
  const limiter = new ReplyRateLimiter({
    viewerCooldownMs: 30_000,
    globalAiPerMinute: 3,
    globalRepliesPerMinute: 10,
  });
  assert.equal(limiter.reserve("viewer-a", "ai", 1_000).allowed, true);
  assert.equal(limiter.reserve("viewer-a", "command", 2_000).reason, "viewer_cooldown");
  assert.equal(limiter.reserve("viewer-b", "ai", 3_000).allowed, true);
  assert.equal(limiter.reserve("viewer-c", "ai", 4_000).allowed, true);
  assert.equal(limiter.reserve("viewer-d", "ai", 5_000).reason, "global_ai_cooldown");
  assert.equal(limiter.reserve("viewer-a", "command", 31_001).allowed, true);
});

test("duplicate suppressor blocks repeated replies only inside its window", () => {
  const duplicate = new DuplicateSuppressor({ windowMs: 10_000 });
  assert.equal(duplicate.accept("Hello  kupo", 1_000), true);
  assert.equal(duplicate.accept("hello kupo", 2_000), false);
  assert.equal(duplicate.accept("hello kupo", 11_001), true);
});

test("privacy-preserving viewer IDs are stable and do not expose channel IDs", () => {
  const first = privacyPreservingViewerId("channel-secret", "a".repeat(32));
  const second = privacyPreservingViewerId("channel-secret", "a".repeat(32));
  assert.equal(first, second);
  assert.doesNotMatch(first, /channel-secret/u);
  assert.match(first, /^viewer_[a-f0-9]{32}$/u);
});
