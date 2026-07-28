import { guardReply, sanitizeViewerText } from "../safety/content.mjs";
import { parseIntent } from "./intent.mjs";

export class ChatRouter {
  constructor({
    mentionAliases,
    botChannelId,
    commands,
    statusProvider,
    answerer,
    rateLimiter,
    duplicateSuppressor,
    maxInputChars = 500,
    maxReplyChars = 380,
  }) {
    this.mentionAliases = mentionAliases;
    this.botChannelId = botChannelId;
    this.commands = commands;
    this.statusProvider = statusProvider;
    this.answerer = answerer;
    this.rateLimiter = rateLimiter;
    this.duplicateSuppressor = duplicateSuppressor;
    this.maxInputChars = maxInputChars;
    this.maxReplyChars = maxReplyChars;
  }

  async route(message) {
    if (!message?.authorChannelId || message.authorChannelId === this.botChannelId) {
      return null;
    }
    const text = sanitizeViewerText(message.text, this.maxInputChars);
    if (!text) return null;
    const intent = parseIntent(text, this.mentionAliases);
    if (!intent) return null;

    const reservation = this.rateLimiter.reserve(message.authorChannelId, intent.kind);
    if (!reservation.allowed) return null;

    const status = await this.statusProvider.get();
    let rawReply;
    if (intent.kind === "command") {
      const handler = this.commands.get(intent.name);
      if (!handler) return null;
      rawReply = await handler({ status });
    } else {
      rawReply = await this.answerer.answer({
        question: intent.question,
        viewerChannelId: message.authorChannelId,
        publicStatus: status,
      });
    }

    const guarded = guardReply(rawReply, this.maxReplyChars);
    if (!guarded.allowed || !this.duplicateSuppressor.accept(guarded.text)) return null;
    return Object.freeze({ kind: intent.kind, text: guarded.text });
  }
}
