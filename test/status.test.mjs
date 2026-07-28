import assert from "node:assert/strict";
import test from "node:test";
import { StatusProvider } from "../status/provider.mjs";
import { parsePublicStatus } from "../status/schema.mjs";

function validStatus(overrides = {}) {
  return {
    schema_version: 1,
    updated_at: "2026-07-28T12:00:00.000Z",
    zone: { id: 107, name: "South Gustaberg" },
    objective: "Test the companion",
    job: { name: "Monk", level: 3 },
    health_status: "healthy",
    recent_action: "observing",
    reason: "testing",
    ...overrides,
  };
}

test("public status accepts only the versioned allowlisted schema", () => {
  const parsed = parsePublicStatus(validStatus());
  assert.equal(parsed.zone.name, "South Gustaberg");
  assert.equal(parsed.job.level, 3);
  assert.throws(
    () => parsePublicStatus({ ...validStatus(), private_log: "secret" }),
    /unexpected field private_log/u,
  );
  assert.throws(
    () => parsePublicStatus(validStatus({ schema_version: 2 })),
    /must equal 1/u,
  );
});

test("status rejects non-allowlisted health values and control characters", () => {
  assert.throws(
    () => parsePublicStatus(validStatus({ health_status: "godmode" })),
    /not allowlisted/u,
  );
  assert.throws(
    () => parsePublicStatus(validStatus({ objective: "bad\u0000text" })),
    /control characters/u,
  );
});

test("HTTP status provider uses GET, sends optional auth, and marks stale data", async () => {
  let request;
  const provider = new StatusProvider({
    source: "http",
    url: "https://status.example.invalid/v1/status",
    bearerToken: "read-only-token",
    maxAgeMs: 1_000,
    clock: () => Date.parse("2026-07-28T12:00:02.000Z"),
    fetchImpl: async (url, options) => {
      request = { url: String(url), options };
      return new Response(JSON.stringify(validStatus()), { status: 200 });
    },
  });
  const result = await provider.get();
  assert.equal(result.available, true);
  assert.equal(result.stale, true);
  assert.equal(request.options.method, "GET");
  assert.equal(request.options.headers.authorization, "Bearer read-only-token");
  assert.equal(request.options.body, undefined);
});

test("status provider fails closed without exposing parse details", async () => {
  const provider = new StatusProvider({
    source: "http",
    url: "https://status.example.invalid/v1/status",
    fetchImpl: async () => new Response('{"unexpected":true}', { status: 200 }),
  });
  assert.deepEqual(await provider.get(), {
    available: false,
    stale: false,
    reason: "invalid_or_unavailable",
    value: null,
  });
});

test("HTTP status endpoints require HTTPS except on loopback", () => {
  assert.throws(
    () => new StatusProvider({
      source: "http",
      url: "http://example.com/status",
    }),
    /HTTPS or loopback HTTP/u,
  );
  assert.doesNotThrow(
    () => new StatusProvider({
      source: "http",
      url: "http://127.0.0.1:8080/status",
    }),
  );
});
