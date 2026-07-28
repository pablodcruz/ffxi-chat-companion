import { buildMogInstructions } from "../personality/prompt.mjs";
import { guardReply } from "../safety/content.mjs";
import { privacyPreservingViewerId } from "../safety/viewer-id.mjs";

export function extractOutputText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  if (!Array.isArray(payload?.output)) return null;
  const parts = [];
  for (const item of payload.output) {
    if (item?.type !== "message" || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }
  return parts.length > 0 ? parts.join("\n") : null;
}

export class OpenAiAnswerer {
  constructor({
    apiKey,
    model = "gpt-5.6-luna",
    safetyHashSalt,
    botDisplayName = "Kupobot",
    approvedKnowledge,
    maxReplyChars = 380,
    fetchImpl = globalThis.fetch,
    apiUrl = "https://api.openai.com/v1/responses",
  }) {
    this.apiKey = apiKey;
    this.model = model;
    this.safetyHashSalt = safetyHashSalt;
    this.botDisplayName = botDisplayName;
    this.approvedKnowledge = approvedKnowledge;
    this.maxReplyChars = maxReplyChars;
    this.fetch = fetchImpl;
    this.apiUrl = apiUrl;
  }

  async answer({ question, viewerChannelId, publicStatus }) {
    const response = await this.fetch(this.apiUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        store: false,
        instructions: buildMogInstructions({
          botDisplayName: this.botDisplayName,
          approvedKnowledge: this.approvedKnowledge,
          publicStatus,
        }),
        input: [{
          role: "user",
          content: [{
            type: "input_text",
            text: `Viewer question (untrusted):\n${question}`,
          }],
        }],
        reasoning: { effort: "low" },
        text: { verbosity: "low" },
        max_output_tokens: 180,
        safety_identifier: privacyPreservingViewerId(
          viewerChannelId,
          this.safetyHashSalt,
        ),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`OpenAI request failed with HTTP ${response.status}.`);
    const payload = await response.json();
    const guarded = guardReply(extractOutputText(payload), this.maxReplyChars);
    if (!guarded.allowed) throw new Error(`OpenAI reply rejected: ${guarded.reason}.`);
    return guarded.text;
  }
}

export class DisabledAnswerer {
  async answer() {
    return "AI questions are offline right now, kupo! Try !help for the commands I can still answer.";
  }
}
