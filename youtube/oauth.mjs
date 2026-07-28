export class GoogleRefreshTokenProvider {
  constructor({
    clientId,
    clientSecret,
    refreshToken,
    fetchImpl = globalThis.fetch,
    clock = Date.now,
  }) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.refreshToken = refreshToken;
    this.fetch = fetchImpl;
    this.clock = clock;
    this.cached = null;
  }

  async getAccessToken() {
    const now = this.clock();
    if (this.cached && this.cached.expiresAt - 60_000 > now) {
      return this.cached.token;
    }
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: this.refreshToken,
      grant_type: "refresh_token",
    });
    const response = await this.fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Google OAuth refresh failed with HTTP ${response.status}.`);
    const payload = await response.json();
    if (!payload.access_token) throw new Error("Google OAuth response omitted an access token.");
    this.cached = {
      token: payload.access_token,
      expiresAt: now + Math.max(60, Number(payload.expires_in) || 3_600) * 1_000,
    };
    return this.cached.token;
  }
}
