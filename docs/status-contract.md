# Read-only status contract

The status feed is the only game-side integration. It is a snapshot, not a
command channel, event bus, log stream, or proxy to the game-agent MCP server.

## Version 1

```json
{
  "schema_version": 1,
  "updated_at": "2026-07-28T12:00:00.000Z",
  "zone": { "id": 107, "name": "South Gustaberg" },
  "objective": "Safely explore and gain experience",
  "job": { "name": "Monk", "level": 3 },
  "health_status": "healthy",
  "recent_action": "observing nearby targets",
  "reason": "looking for an isolated easy-prey target"
}
```

All root and nested objects are strict. Unexpected fields reject the whole
snapshot. This is deliberate: adding a raw log, character identifier, server
address, token, path, or control field must fail closed instead of becoming
implicitly public.

Constraints:

- `schema_version` is exactly `1`.
- `updated_at` is an ISO-8601 timestamp.
- `zone.id` is null or an integer from 0 through 999.
- `zone.name` is null or at most 80 characters.
- `objective` and `recent_action` are null or at most 160 characters.
- `reason` is null or at most 200 characters.
- `job.name` is null or at most 40 characters.
- `job.level` is null or an integer from 1 through 99.
- `health_status` is `healthy`, `caution`, `critical`, `defeated`, or
  `unknown`.
- Control characters are forbidden.
- The entire document is at most 16 KiB.

Snapshots older than `STATUS_MAX_AGE_SECONDS` are treated as stale and are not
reported as current state.

## Producer requirements

The producer belongs in `ffxi-agents-server`, but must be separate from its MCP
control server:

1. Map internal state into this fixed public schema.
2. Write to a dedicated file using atomic replacement, or expose a dedicated
   GET-only endpoint.
3. Do not copy arbitrary action text, entity/player names, chat, logs, errors,
   coordinates, addresses, paths, or credentials.
4. Treat every string as public before publishing it.
5. Use a dedicated read-only bearer credential if the endpoint is not
   loopback-only.
6. Give the companion no bridge token, MCP transport, control credentials,
   database access, or filesystem access beyond the single snapshot.

An HTTP deployment should independently enforce GET-only routing. The
companion client itself implements only GET for this status source.

## Compatibility

Breaking or additive fields require a new schema version and companion update.
Do not add fields silently: strict rejection is part of the privacy boundary.
