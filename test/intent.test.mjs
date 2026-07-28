import assert from "node:assert/strict";
import test from "node:test";
import { parseIntent } from "../bot/intent.mjs";

test("intent parser accepts only allowlisted commands", () => {
  assert.deepEqual(parseIntent("!STATUS", ["Kupobot"]), {
    kind: "command",
    name: "status",
  });
  assert.equal(parseIntent("!ban viewer", ["Kupobot"]), null);
  assert.equal(parseIntent("hello everyone", ["Kupobot"]), null);
});

test("intent parser requires a direct mention for AI questions", () => {
  assert.deepEqual(
    parseIntent("@Kupobot: How does combat work?", ["Kupobot"]),
    { kind: "ai", question: "How does combat work?" },
  );
  assert.equal(parseIntent("How does combat work?", ["Kupobot"]), null);
  assert.deepEqual(parseIntent("@Kupobot", ["Kupobot"]), {
    kind: "command",
    name: "help",
  });
});
