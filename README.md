# FFXI Chat Companion

`ffxi-chat-companion` is an unofficial, independently deployable YouTube Live
chat companion for streams powered by
[`ffxi-agents-server`](https://github.com/pablodcruz/ffxi-agents-server).

Its working persona is **Kupobot, the Mog Research Assistant**: an original
moogle-inspired AI companion that answers a small command set and direct
mentions. It does not impersonate a named FFXI character, does not moderate
viewers, and cannot control gameplay.

Final Fantasy XI and related names and assets belong to Square Enix. This
fan-made project is not affiliated with or endorsed by Square Enix.

## Safety boundary

```text
game agent -> sanitized status-v1 JSON -> chat companion -> YouTube Live Chat
```

There is intentionally no path in the opposite direction. This repository:

- contains no MCP client and no gameplay command adapter;
- accepts status only through a strict, versioned, read-only schema;
- rejects unexpected status fields;
- never passes credentials, raw logs, viewer names, or local paths to the AI;
- gives the AI no tools and stores no conversational state;
- responds only to five allowlisted commands or a direct bot mention;
- applies per-viewer, global, AI-specific, and duplicate-response limits;
- performs no bans, deletions, timeouts, or autonomous chatter; and
- simulates YouTube writes unless `DRY_RUN=false` is set explicitly.

See [goal.md](goal.md) for the product definition and
[docs/threat-model.md](docs/threat-model.md) for the trust boundaries.

## Commands

- `!status` — sanitized objective, health state, and recent action
- `!zone` — sanitized zone name and ID
- `!why` — sanitized reason for the current action
- `!project` — project explanation and repository links
- `!help` — command and mention syntax
- `@Kupobot <question>` — short AI answer grounded in approved knowledge and
  fresh sanitized status

Messages without a command or direct mention receive no response. When the
status feed is missing or stale, status commands say so instead of guessing.

## Requirements

- Node.js 20 or newer
- A YouTube channel eligible for live streaming
- A Google Cloud OAuth 2.0 client authorized for
  `https://www.googleapis.com/auth/youtube.force-ssl`
- An OpenAI API key only if mention Q&A is enabled

There are no production npm dependencies in v1.

## Local verification

The offline demo needs no credentials and never uses the network:

```sh
npm run demo
npm test
npm run check
npm run status:validate -- runtime/status-v1.example.json
```

The demo uses fixed sanitized status and keeps AI disabled. It demonstrates
all commands plus the safe “AI offline” fallback.

`status:validate` checks a prospective producer snapshot against the exact
strict schema and 16 KiB document limit without printing its file path or
field values.

## Configuration

Copy `.env.example` into your secret manager or deployment configuration. The
service does not load `.env` files itself, preventing accidental reliance on a
secret file in production. Export the values through the runtime environment.

Important defaults:

```text
DRY_RUN=true
AI_ENABLED=false
STATUS_SOURCE=none
VIEWER_COOLDOWN_SECONDS=45
GLOBAL_AI_REPLIES_PER_MINUTE=3
GLOBAL_REPLIES_PER_MINUTE=10
```

`YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, and `YOUTUBE_REFRESH_TOKEN` must
be configured together. Set `YOUTUBE_LIVE_CHAT_ID` to a known active chat or
let the service discover the authenticated channel's active broadcast.

After injecting OAuth credentials, verify the read path without posting:

```sh
npm run youtube:doctor
```

The doctor refreshes OAuth, discovers or uses the configured chat, and reads
one message page. Its output contains only booleans, counts, and YouTube's
polling interval—never chat IDs, page tokens, message text, or viewer IDs.

When live posting is enabled, `YOUTUBE_BOT_CHANNEL_ID` is required so the
service can ignore its own messages. Generate `SAFETY_HASH_SALT` with at least
32 random characters; it hashes viewer channel IDs before they are sent as
OpenAI safety identifiers.

Never commit Google client-secret files, refresh tokens, API keys, status
bearer tokens, or generated `.env` files. Common credential filenames are
ignored by Git.

## YouTube OAuth

1. Create or select a Google Cloud project.
2. Enable YouTube Data API v3.
3. Configure the OAuth consent screen.
4. Create an OAuth client appropriate for the deployment.
5. Authorize the streaming channel with the
   `youtube.force-ssl` scope and request offline access.
6. Store the client ID, client secret, and refresh token in the deployment's
   secret manager.
7. Start with `DRY_RUN=true` and verify intended replies in sanitized logs.
8. Set `DRY_RUN=false` only after cooldowns and the bot channel ID are verified.

YouTube service accounts are not supported for ordinary channel live-chat
access. The client polls `liveChatMessages.list` and honors YouTube's returned
`pollingIntervalMillis`; startup history is marked seen without replies.

## AI behavior

Mention Q&A uses the OpenAI Responses API. The default is the configurable
high-volume model `gpt-5.6-luna` with low reasoning effort and low verbosity.
Each request:

- sets `store: false`;
- includes no tools;
- includes only allowlisted knowledge and sanitized status;
- labels the viewer question as untrusted;
- sends a salted hash rather than a raw viewer channel ID; and
- caps model output before applying a second local response guard.

Set `AI_ENABLED=true`, `OPENAI_API_KEY`, and `SAFETY_HASH_SALT` to enable it.
The deterministic commands continue to work if AI is off or unavailable.

## Status feed

The companion supports:

- `STATUS_SOURCE=none` — safe default;
- `STATUS_SOURCE=file` — read a JSON document from `STATUS_FILE`; or
- `STATUS_SOURCE=http` — issue GET requests to `STATUS_URL`.

Remote status requires HTTPS. Plain HTTP is accepted only on loopback.
`STATUS_BEARER_TOKEN` is optional and is used only as a bearer credential on
the GET request. The client never sends POST, PUT, PATCH, or DELETE requests to
the game-agent side.

The exact schema and producer guidance are in
[docs/status-contract.md](docs/status-contract.md). A non-secret example is in
[`runtime/status-v1.example.json`](runtime/status-v1.example.json).

## Run

Provide configuration through the environment, then:

```sh
npm start
```

Or build the dependency-free container:

```sh
docker build -t ffxi-chat-companion .
docker run --rm --env-file /secure/path/companion.env ffxi-chat-companion
```

The container does not include a status file or credentials. Mount only the
single sanitized JSON document if file mode is used; do not mount the
game-agent repository, logs, home directory, Docker socket, or bridge runtime.

## Operational rollout

Use this order:

1. Run unit tests and the offline demo.
2. Configure YouTube OAuth with `DRY_RUN=true` and AI disabled.
3. Run `npm run youtube:doctor`, then observe command routing without live
   posting.
4. Enable live posting for deterministic commands.
5. Set a small OpenAI project budget and enable mention Q&A.
6. Add the one-way status producer after its output passes the contract tests.

Keep YouTube slow mode, blocked words, and held-message review as the primary
moderation layer. This service deliberately does not take moderation actions.

Run exactly one companion replica in v1. Cooldown and duplicate-suppression
state is intentionally in memory; multiple replicas would each enforce a
separate limit and could produce duplicate replies.
