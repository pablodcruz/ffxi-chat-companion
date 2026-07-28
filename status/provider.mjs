import { readFile } from "node:fs/promises";
import path from "node:path";
import { parsePublicStatus } from "./schema.mjs";

const MAX_STATUS_BYTES = 16 * 1024;

function unavailable(reason) {
  return Object.freeze({ available: false, stale: false, reason, value: null });
}

function assessFreshness(value, maxAgeMs, nowMs) {
  const updatedAtMs = Date.parse(value.updated_at);
  if (updatedAtMs > nowMs + 30_000) return unavailable("future_timestamp");
  const ageMs = Math.max(0, nowMs - updatedAtMs);
  return Object.freeze({
    available: true,
    stale: ageMs > maxAgeMs,
    ageMs,
    value,
  });
}

function validateStatusUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (url.username || url.password) {
    throw new Error("STATUS_URL must not contain credentials.");
  }
  const loopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new Error("STATUS_URL must use HTTPS or loopback HTTP.");
  }
  return url;
}

async function parseBody(text) {
  if (Buffer.byteLength(text, "utf8") > MAX_STATUS_BYTES) {
    throw new Error("Status document exceeds 16 KiB.");
  }
  return parsePublicStatus(JSON.parse(text));
}

export class StatusProvider {
  constructor({
    source = "none",
    file,
    url,
    bearerToken,
    maxAgeMs = 120_000,
    fetchImpl = globalThis.fetch,
    cwd = process.cwd(),
    clock = Date.now,
  } = {}) {
    this.source = source;
    this.file = file;
    this.url = url ? validateStatusUrl(url) : null;
    this.bearerToken = bearerToken;
    this.maxAgeMs = maxAgeMs;
    this.fetch = fetchImpl;
    this.cwd = cwd;
    this.clock = clock;
  }

  async get() {
    if (this.source === "none") return unavailable("not_configured");
    try {
      const value = this.source === "file"
        ? await this.#fromFile()
        : await this.#fromHttp();
      return assessFreshness(value, this.maxAgeMs, this.clock());
    } catch {
      return unavailable("invalid_or_unavailable");
    }
  }

  async #fromFile() {
    const resolved = path.resolve(this.cwd, this.file);
    const text = await readFile(resolved, { encoding: "utf8" });
    return parseBody(text);
  }

  async #fromHttp() {
    const headers = { accept: "application/json" };
    if (this.bearerToken) headers.authorization = `Bearer ${this.bearerToken}`;
    const response = await this.fetch(this.url, {
      method: "GET",
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error("Status endpoint unavailable.");
    return parseBody(await response.text());
  }
}

export class StaticStatusProvider {
  constructor(result = unavailable("not_configured")) {
    this.result = result;
  }

  async get() {
    return this.result;
  }
}
