import { setTimeout as wait } from "node:timers/promises";

async function sleep(delayMs, signal) {
  try {
    // The Node timer unregisters its abort listener when it settles.
    await wait(delayMs, undefined, { signal });
  } catch (error) {
    // Keep the caller's shutdown reason instead of the timer's wrapper.
    signal?.throwIfAborted();
    throw error;
  }
}

export class LiveChatPoller {
  constructor({
    youtube,
    liveChatId,
    router,
    logger,
    clock = Date.now,
  }) {
    this.youtube = youtube;
    this.liveChatId = liveChatId;
    this.router = router;
    this.logger = logger;
    this.clock = clock;
    this.startedAt = this.clock();
    this.pageToken = null;
    this.initialized = false;
    this.seen = new Map();
  }

  async pollOnce() {
    const page = await this.youtube.listMessages({
      liveChatId: this.liveChatId,
      pageToken: this.pageToken,
    });
    this.pageToken = page.nextPageToken;

    const unseen = page.messages.filter((message) => {
      if (!message.id || this.seen.has(message.id)) return false;
      this.seen.set(message.id, this.clock());
      return this.initialized
        && (!message.publishedAt || Date.parse(message.publishedAt) >= this.startedAt);
    });
    this.initialized = true;
    this.#trimSeen();

    for (const message of unseen) {
      try {
        const reply = await this.router.route(message);
        if (!reply) continue;
        const result = await this.youtube.postMessage({
          liveChatId: this.liveChatId,
          text: reply.text,
        });
        if (result.id) this.seen.set(result.id, this.clock());
        this.logger.info({
          event: "reply",
          kind: reply.kind,
          dry_run: result.dryRun,
        });
      } catch {
        this.logger.error({ event: "message_failed", reason: "handler_error" });
      }
    }
    return page;
  }

  async run({ signal } = {}) {
    let consecutiveFailures = 0;
    while (!signal?.aborted) {
      try {
        const page = await this.pollOnce();
        consecutiveFailures = 0;
        if (page.offlineAt) {
          this.logger.info({ event: "chat_offline" });
          return;
        }
        this.logger.info({ event: "poll", delay_ms: page.pollingIntervalMillis });
        await sleep(page.pollingIntervalMillis, signal);
      } catch (error) {
        if (signal?.aborted) throw error;
        consecutiveFailures += 1;
        const delayMs = Math.min(30_000, 1_000 * 2 ** Math.min(5, consecutiveFailures - 1));
        this.logger.error({ event: "poll_failed", reason: "transient_error" });
        await sleep(delayMs, signal);
      }
    }
  }

  #trimSeen() {
    if (this.seen.size <= 5_000) return;
    const oldest = [...this.seen.entries()]
      .sort((left, right) => left[1] - right[1])
      .slice(0, this.seen.size - 4_000);
    for (const [id] of oldest) this.seen.delete(id);
  }
}
