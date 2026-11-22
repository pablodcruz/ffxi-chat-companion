import assert from "node:assert/strict";
import test from "node:test";
import { renderTranscript } from "../scripts/transcript.mjs";
import { runInNewContext } from "node:vm";

test("transcript treats speaker and message as text even with markup-like input", () => {
  const result = renderTranscript([{ speaker: "<Viewer>", text: '</li><img src="https://example.invalid"> & text' }]);
  assert.match(result, /&lt;Viewer&gt;/);
  assert.match(result, /&lt;\/li&gt;&lt;img src=&quot;https:\/\/example\.invalid&quot;&gt; &amp; text/);
  assert.doesNotMatch(result, /<img /);
  assert.match(result, /default-src 'none'/);
});

test("the inline playback controller steps, pauses via Escape, and returns focus when finished", () => {
  const lines = ["A question", "A reply", "A follow-up"].map((text, index) => ({
    hidden: false,
    querySelector(selector) {
      return { textContent: selector === ".message" ? text : (index === 1 ? "Kupobot" : "Viewer") };
    },
  }));
  const document = { activeElement: null };
  const nodes = Object.fromEntries(["tape", "next", "play", "restart", "state", "progress",
    "announcement", "controls", "document"].map((key) => [key, {
    hidden: key === "controls",
    handlers: new Map(),
    addEventListener(type, handler) { this.handlers.set(type, handler); },
    focus() { document.activeElement = this; },
  }]));
  Object.assign(document, {
    getElementById: (key) => nodes[key],
    addEventListener: (...args) => nodes.document.addEventListener(...args),
  });
  nodes.tape.querySelectorAll = () => lines;
  let count = 0;
  const timers = new Map();
  function tick() {
    assert.equal(timers.size, 1);
    const [[id, callback]] = timers;
    timers.delete(id);
    callback();
  }
  const script = renderTranscript([]).match(/<script>([\s\S]*?)<\/script>/)[1];
  runInNewContext(script, { document, setTimeout: (fn) => { timers.set(++count, fn); return count; },
    clearTimeout: (id) => timers.delete(id) });
  assert.equal(nodes.controls.hidden, false);
  assert.equal(nodes.state.textContent, "Ready");
  assert.deepEqual(lines.map((line) => line.hidden), [false, true, true]);
  nodes.play.focus();
  nodes.play.handlers.get("click")();
  assert.equal(nodes.next.disabled, true);
  tick();
  assert.equal(nodes.progress.textContent, "2 / 3 messages");
  assert.equal(nodes.announcement.textContent, "Kupobot: A reply");
  let handled = false;
  nodes.document.handlers.get("keydown")({ key: "Escape", preventDefault() { handled = true; } });
  assert.equal(handled, true);
  assert.equal(timers.size, 0);
  assert.equal(nodes.state.textContent, "Paused");
  nodes.next.focus();
  nodes.next.handlers.get("click")();
  assert.equal(nodes.state.textContent, "End of tape");
  assert.equal(document.activeElement, nodes.restart);
  nodes.restart.handlers.get("click")();
  assert.equal(nodes.progress.textContent, "1 / 3 messages");
  assert.deepEqual(lines.map((line) => line.hidden), [false, true, true]);
  assert.equal(timers.size, 0);
});
