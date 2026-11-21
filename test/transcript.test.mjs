import assert from "node:assert/strict";
import test from "node:test";
import { renderTranscript } from "../scripts/transcript.mjs";

test("transcript treats speaker and message as text even with markup-like input", () => {
  const result = renderTranscript([{ speaker: "<Viewer>", text: '</li><img src="https://example.invalid"> & text' }]);
  assert.match(result, /&lt;Viewer&gt;/);
  assert.match(result, /&lt;\/li&gt;&lt;img src=&quot;https:\/\/example\.invalid&quot;&gt; &amp; text/);
  assert.doesNotMatch(result, /<img /);
  assert.match(result, /default-src 'none'/);
});
