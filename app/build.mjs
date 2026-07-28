import { OpenAiAnswerer, DisabledAnswerer } from "../ai/openai-client.mjs";
import { ChatRouter } from "../bot/router.mjs";
import { createCommands } from "../commands/registry.mjs";
import { loadApprovedKnowledge } from "../knowledge/load.mjs";
import { DuplicateSuppressor, ReplyRateLimiter } from "../safety/rate-limiter.mjs";
import { StatusProvider } from "../status/provider.mjs";

export async function buildRouter(config, overrides = {}) {
  const statusProvider = overrides.statusProvider || new StatusProvider({
    ...config.status,
    fetchImpl: overrides.fetchImpl,
  });
  const approvedKnowledge =
    overrides.approvedKnowledge || await loadApprovedKnowledge();
  const answerer = overrides.answerer || (config.aiEnabled
    ? new OpenAiAnswerer({
      ...config.openai,
      botDisplayName: config.botDisplayName,
      approvedKnowledge,
      maxReplyChars: config.limits.maxReplyChars,
      fetchImpl: overrides.fetchImpl,
    })
    : new DisabledAnswerer());
  return new ChatRouter({
    mentionAliases: config.mentionAliases,
    botChannelId: config.youtube.botChannelId,
    commands: createCommands(config),
    statusProvider,
    answerer,
    rateLimiter: overrides.rateLimiter || new ReplyRateLimiter(config.limits),
    duplicateSuppressor:
      overrides.duplicateSuppressor || new DuplicateSuppressor({
        windowMs: config.limits.duplicateWindowMs,
      }),
    maxInputChars: config.limits.maxInputChars,
    maxReplyChars: config.limits.maxReplyChars,
  });
}
