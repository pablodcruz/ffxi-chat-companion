# Operations

## Preflight

Run:

```sh
npm test
npm run check
npm run demo
```

Confirm that:

- `DRY_RUN=true`;
- `AI_ENABLED=false`;
- the bot channel ID is correct before live posting;
- the authenticated YouTube account owns the intended bot identity;
- YouTube slow mode and channel moderation controls are configured;
- no game-agent secrets or directories are mounted; and
- the OpenAI project has an explicit budget before AI is enabled.

## Startup behavior

The service discovers the authenticated channel's active broadcast unless
`YOUTUBE_LIVE_CHAT_ID` is set. It retrieves the first page of current chat
history, records those message IDs, and sends no replies to them. Only later
unseen text messages are routed.

The client follows `pollingIntervalMillis` returned by YouTube. It does not
retry in a tight loop. A reported offline timestamp ends the process cleanly.
Transient polling failures use bounded exponential backoff. IDs returned by
successful chat inserts are marked seen as a second defense against self-reply
loops.

## Rollout gates

1. Offline demo and tests pass.
2. OAuth reading works in dry-run mode.
3. Planned replies in sanitized logs match expectations.
4. Deterministic commands work with live posting.
5. The status snapshot is fresh and contains no private fields.
6. AI project budget is configured.
7. Mention Q&A is enabled.

## Incident response

For unexpected posting, stop the container/process first. Then revoke the
Google refresh token, rotate the OAuth client secret if exposure is suspected,
and rotate the status credential. Disable or delete the OpenAI API key if cost
or disclosure is suspected.

Do not add autonomous moderation as an incident workaround. Use YouTube Studio
to control slow mode, blocked words, held messages, moderators, and bans.

## Logging

Logs contain event type, reply kind, safe reason codes, counts, delays, dry-run
state, and status-source mode. They intentionally omit message text, viewer
names, channel IDs, chat IDs, OAuth values, API responses, model prompts, local
paths, and status content.
