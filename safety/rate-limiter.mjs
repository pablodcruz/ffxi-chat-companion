function trimWindow(timestamps, threshold) {
  while (timestamps.length > 0 && timestamps[0] <= threshold) timestamps.shift();
}

export class ReplyRateLimiter {
  constructor({
    viewerCooldownMs = 45_000,
    globalAiPerMinute = 3,
    globalRepliesPerMinute = 10,
    clock = Date.now,
  } = {}) {
    this.viewerCooldownMs = viewerCooldownMs;
    this.globalAiPerMinute = globalAiPerMinute;
    this.globalRepliesPerMinute = globalRepliesPerMinute;
    this.clock = clock;
    this.viewerLastReply = new Map();
    this.aiReplies = [];
    this.allReplies = [];
  }

  reserve(viewerId, kind, now = this.clock()) {
    const viewerLast = this.viewerLastReply.get(viewerId);
    if (viewerLast !== undefined && now - viewerLast < this.viewerCooldownMs) {
      return Object.freeze({ allowed: false, reason: "viewer_cooldown" });
    }

    const threshold = now - 60_000;
    trimWindow(this.aiReplies, threshold);
    trimWindow(this.allReplies, threshold);
    if (this.allReplies.length >= this.globalRepliesPerMinute) {
      return Object.freeze({ allowed: false, reason: "global_cooldown" });
    }
    if (kind === "ai" && this.aiReplies.length >= this.globalAiPerMinute) {
      return Object.freeze({ allowed: false, reason: "global_ai_cooldown" });
    }

    this.viewerLastReply.set(viewerId, now);
    this.allReplies.push(now);
    if (kind === "ai") this.aiReplies.push(now);
    return Object.freeze({ allowed: true, reason: null });
  }
}

export class DuplicateSuppressor {
  constructor({ windowMs = 20_000, clock = Date.now } = {}) {
    this.windowMs = windowMs;
    this.clock = clock;
    this.replies = new Map();
  }

  accept(text, now = this.clock()) {
    for (const [reply, timestamp] of this.replies) {
      if (now - timestamp >= this.windowMs) this.replies.delete(reply);
    }
    const normalized = text.toLocaleLowerCase().replace(/\s+/gu, " ").trim();
    if (this.replies.has(normalized)) return false;
    this.replies.set(normalized, now);
    return true;
  }
}
