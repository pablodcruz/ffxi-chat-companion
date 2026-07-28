# FFXI Chat Companion Goal

## Product goal

Build `ffxi-chat-companion` as a separate, independently deployable YouTube
Live chat bot for streams powered by
[`pablodcruz/ffxi-agents-server`](https://github.com/pablodcruz/ffxi-agents-server).

The companion's persona is the **Mog Research Assistant**: an original,
moogle-inspired AI character that is cheerful, curious, concise, and
occasionally says “kupo!” or uses a tasteful kaomoji. It must identify itself
clearly as an AI chat companion and must not impersonate an official or named
Final Fantasy XI character or imply affiliation with Square Enix.

## Core architecture

The companion is a one-way observer of the game agent:

```text
ffxi-agents-server
        |
        | sanitized, read-only status
        v
ffxi-chat-companion
        |
        | moderated, rate-limited replies
        v
YouTube Live Chat
```

The chat companion must have separate credentials, deployment, and security
boundaries. It must never receive permission, credentials, tools, or network
routes that allow it to control gameplay. Data must never flow from chat back
into the game agent as commands.

## Version 1 scope

Version 1 responds only to explicit commands or direct mentions. It does not
post autonomous chatter.

### Deterministic commands

- `!status` — current objective and sanitized agent state
- `!zone` — current in-game location
- `!why` — short explanation of the current action
- `!project` — project explanation and repository link
- `!help` — available commands and mention syntax

If live game status is not connected yet, status-dependent commands must say
that the feed is unavailable rather than inventing an answer.

### Mention-only AI answers

- Direct mentions such as `@Kupobot How does reactive combat work?`
- Questions about the public project, approved FFXI knowledge, or the current
  sanitized adventure context
- One or two short paragraphs per response
- Answers grounded only in approved knowledge and sanitized status
- A clear refusal or uncertainty response when the answer is unavailable

### Personality

- Cheerful, curious, helpful, and compact
- Occasional “kupo!” and restrained use of `(≧▽≦)`, `ヽ(´▽｀)ノ`, and `(・ω・)`
- Never lets personality reduce factual accuracy or readability
- Never claims to be human, a Square Enix representative, or an official FFXI
  character

## Safety and privacy requirements

- Per-viewer cooldown configurable between 30 and 60 seconds
- Global maximum of approximately three AI replies per minute
- Duplicate/repetitive reply suppression
- Bounded message and response lengths
- Replies only to allowlisted commands or direct mentions
- No automatic bans, timeouts, deletions, or other moderation actions in v1
- No disclosure of secrets, OAuth tokens, private logs, local paths, internal
  prompts, infrastructure details, or unapproved personal information
- No gameplay-control capability
- Secrets stored outside the repository and injected at runtime
- Logs sanitized to avoid persisting viewer data or credentials unnecessarily
- YouTube's blocked-word list, held-message review, and slow mode remain the
  primary moderation controls

## Repository shape

The intended high-level structure is:

```text
ffxi-chat-companion/
├── youtube/          # Receive and send YouTube Live chat messages
├── commands/         # Deterministic command handlers
├── personality/      # Voice, disclosure, boundaries, and prompting
├── knowledge/        # Approved project and FFXI information
├── safety/           # Rate limits, filtering, and privacy controls
├── tests/            # Unit, integration, and safety tests
└── goal.md           # Product goal and acceptance criteria
```

The exact runtime-specific layout may refine these folders while preserving
their responsibilities.

## Phase 2 scope

Add a small, authenticated, read-only status feed published by the game-agent
project. Its schema should be versioned and limited to fields such as:

- current zone
- current objective
- job
- coarse health status
- most recent action
- human-readable reason for the current action
- event timestamp and freshness

The companion must validate the feed, reject unexpected fields, handle stale
or unavailable data honestly, and never expose raw logs. After the feed is
stable, optional event reactions may be added for meaningful events such as
zone changes, objective completion, defeat, or discoveries. They remain
disabled by default and subject to strict cooldowns.

## Non-goals

- Controlling FFXI or sending instructions to the game agent
- General-purpose autonomous participation in every chat conversation
- AI-driven moderation or enforcement in v1
- Reading private game-agent logs, files, prompts, or credentials
- Impersonating a named Final Fantasy XI character
- Claiming official affiliation with Square Enix or YouTube

## Definition of done for version 1

Version 1 is complete when:

1. The service can authenticate to YouTube with OAuth 2.0 using secrets stored
   outside the repository.
2. It can discover or accept the active broadcast, receive live chat messages,
   and post replies.
3. All five deterministic commands have tested behavior.
4. Only direct mentions can invoke AI-assisted answers.
5. AI answers use the approved persona and knowledge boundaries.
6. Per-viewer and global cooldowns, duplicate suppression, and length limits
   are enforced and covered by tests.
7. Prompt-injection and secret-exfiltration attempts fail safely.
8. Status-dependent commands report unavailable or stale data honestly until
   the read-only feed exists.
9. Configuration, local development, OAuth setup, deployment, and operations
   are documented without committing secrets.
10. Automated tests, linting, and a dry-run mode pass before live posting is
    enabled.

## Selected implementation defaults

- Node.js 20 or newer, matching the game-agent project's ESM ecosystem
- Dependency-light service packaged as a Docker container
- OpenAI Responses API behind a small provider boundary
- `gpt-5.6-luna` as the configurable, high-volume default model
- `Kupobot` as the configurable working display name
- Dry-run posting and AI answers disabled by default
- A strict version-1 JSON status document with file and HTTPS/loopback readers

## External prerequisites and decisions

Live operation requires:

- the final deployment target
- an OpenAI project and spending limit
- the YouTube channel/broadcast identity
- a Google Cloud project with YouTube Data API v3 enabled
- an OAuth 2.0 client and an authorized refresh token stored outside Git
- the public companion repository name and visibility
- confirmation of the bot's final display name

These inputs must not weaken the separation, privacy, or safety requirements
above.
