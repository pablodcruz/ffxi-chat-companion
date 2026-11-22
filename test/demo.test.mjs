import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

const entry = fileURLToPath(new URL("../scripts/demo.mjs", import.meta.url));
const platformEnv = process.platform === "win32" ? { SystemRoot: process.env.SystemRoot } : {};

function invokeDemo(env, args = []) {
  const result = spawnSync(process.execPath, [entry, ...args], {
    encoding: "utf8",
    env: { ...platformEnv, ...env },
    timeout: 5_000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return result.stdout;
}

function runDemo(env) {
  const stdout = invokeDemo(env);
  for (const command of ["help", "status", "zone", "why", "project"]) {
    assert.match(stdout, new RegExp(`^viewer> !${command}\\n^bot> (?!\\(no reply\\))`, "m"));
  }
  const projectReply = stdout.match(/^viewer> !project\n^bot> (.+)$/m)?.[1];
  assert.ok(projectReply?.includes("https://github.com/pablodcruz/ffxi-agents-server"));
  assert.ok(projectReply?.includes("https://github.com/pablodcruz/ffxi-chat-companion"));
  assert.match(stdout, /^viewer> @Kupobot .+\n^bot> AI questions are offline right now/m);
  return stdout;
}

test("offline demo shows all commands, project links, and the AI fallback", () => {
  runDemo({});
});

test("offline demo ignores unrelated runtime settings and partial synthetic credentials", () => {
  const noisy = runDemo({
    BOT_DISPLAY_NAME: "FixtureOtherBot",
    BOT_MENTION_ALIASES: "FixtureOtherAlias",
    PROJECT_URL: "https://example.invalid/project",
    COMPANION_URL: "https://example.invalid/companion",
    YOUTUBE_CLIENT_ID: "synthetic-partial-id",
    DRY_RUN: "false",
    AI_ENABLED: "true",
    STATUS_SOURCE: "http",
    STATUS_URL: "https://example.invalid/status",
    GLOBAL_REPLIES_PER_MINUTE: "1",
  });
  assert.equal(noisy, runDemo({}));
});

test("Campfire HTML is the same offline transcript even with ambient settings", () => {
  const clean = invokeDemo({}, ["--html"]);
  const noisy = invokeDemo({
    BOT_DISPLAY_NAME: "WrongFixtureBot",
    PROJECT_URL: "https://example.invalid/project",
    YOUTUBE_CLIENT_ID: "synthetic-partial-id",
    AI_ENABLED: "true",
    STATUS_SOURCE: "http",
  }, ["--html"]);
  assert.equal(noisy, clean);
  const text = runDemo({}).trimEnd().split("\n");
  const messages = [...clean.matchAll(/<p class="message">([^<]*)<\/p>/g)].map(([, value]) =>
    value.replace(/&(amp|lt|gt|quot);/g, (_, entity) => ({ amp: "&", lt: "<", gt: ">", quot: '"' })[entity]));
  assert.deepEqual(messages, text.map((line) => line.slice(line.indexOf("> ") + 2)));
});
