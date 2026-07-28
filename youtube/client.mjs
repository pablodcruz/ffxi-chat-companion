function messageFromItem(item) {
  if (item?.snippet?.type !== "textMessageEvent") return null;
  return Object.freeze({
    id: item.id,
    authorChannelId: item.authorDetails?.channelId || null,
    text: item.snippet?.displayMessage || "",
    publishedAt: item.snippet?.publishedAt || null,
  });
}

export class YouTubeLiveClient {
  constructor({
    accessTokenProvider,
    fetchImpl = globalThis.fetch,
    dryRun = true,
    apiBase = "https://www.googleapis.com/youtube/v3/",
  }) {
    this.accessTokenProvider = accessTokenProvider;
    this.fetch = fetchImpl;
    this.dryRun = dryRun;
    this.apiBase = apiBase;
  }

  async #request(resource, { method = "GET", query = {}, body } = {}) {
    const url = new URL(resource, this.apiBase);
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
    const accessToken = await this.accessTokenProvider.getAccessToken();
    const response = await this.fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(`YouTube API request failed with HTTP ${response.status}.`);
    }
    return response.json();
  }

  async findActiveLiveChatId() {
    const payload = await this.#request("liveBroadcasts", {
      query: {
        part: "snippet,status",
        broadcastStatus: "active",
        broadcastType: "all",
        mine: "true",
        maxResults: 5,
      },
    });
    const active = payload.items?.find(
      (item) => item.status?.lifeCycleStatus === "live" && item.snippet?.liveChatId,
    );
    if (!active) throw new Error("No active YouTube broadcast with live chat was found.");
    return active.snippet.liveChatId;
  }

  async listMessages({ liveChatId, pageToken }) {
    const payload = await this.#request("liveChat/messages", {
      query: {
        liveChatId,
        part: "id,snippet,authorDetails",
        maxResults: 200,
        pageToken,
      },
    });
    return Object.freeze({
      messages: (payload.items || []).map(messageFromItem).filter(Boolean),
      nextPageToken: payload.nextPageToken || null,
      pollingIntervalMillis: Math.min(
        30_000,
        Math.max(1_000, Number(payload.pollingIntervalMillis) || 5_000),
      ),
      offlineAt: payload.offlineAt || null,
    });
  }

  async postMessage({ liveChatId, text }) {
    if (this.dryRun) return Object.freeze({ dryRun: true });
    const payload = await this.#request("liveChat/messages", {
      method: "POST",
      query: { part: "snippet" },
      body: {
        snippet: {
          liveChatId,
          type: "textMessageEvent",
          textMessageDetails: { messageText: text },
        },
      },
    });
    return Object.freeze({ dryRun: false, id: payload.id || null });
  }
}
