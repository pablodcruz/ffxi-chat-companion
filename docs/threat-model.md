# Threat model

## Assets to protect

- YouTube OAuth client secret and refresh token
- OpenAI API key and project budget
- status-feed bearer token
- game-agent bridge, MCP, database, and server credentials
- private logs, prompts, local paths, and infrastructure details
- viewer identity and message content
- the integrity of the stream's public chat

## Trust boundaries

Viewer messages, YouTube message metadata, AI output, and status transport are
untrusted. Only repository-controlled knowledge files and status fields that
pass the strict v1 parser are approved AI context.

The companion deployment must not share:

- a process, container, filesystem, environment, service account, or writable
  volume with the game agent;
- MCP or AgentBridge credentials;
- a network route to gameplay-control listeners;
- Docker or host-management sockets; or
- raw game-agent logs.

## Controls

| Threat | Control |
| --- | --- |
| Prompt injection | Mention text is labeled untrusted; the AI has no tools and receives only approved context |
| Secret exfiltration | Secrets are never added to model input; local output guards reject key/path patterns |
| Gameplay commands | No MCP dependency or write-capable game adapter exists; status client is GET-only |
| Stale or fabricated state | Strict timestamp freshness; unavailable/stale commands refuse to guess |
| Chat spam | 30-60 second viewer cooldown, global reply cap, three-AI-reply cap, duplicate suppression |
| Restart reply storm | Initial YouTube history is marked seen without routing |
| Self-reply loop | Live mode requires and ignores the bot's channel ID |
| Private-field creep | Status parser rejects every unexpected field |
| Viewer tracking | No viewer names in AI requests or logs; channel IDs are salted and hashed for AI safety identifiers |
| Cost abuse | Mention-only AI, global cap, short outputs, provider budget recommendation |
| Unsafe links | Model output permits only the two approved project repository URLs |
| Moderation overreach | No ban, delete, timeout, or message-review capabilities |

## Residual risks

- A model can still produce incorrect public information. Approved knowledge,
  output limits, and honest uncertainty reduce but do not eliminate this risk.
- YouTube and OpenAI availability can interrupt replies. The service should
  fail silent rather than retry aggressively.
- A compromised deployment can read its own injected secrets. Use a dedicated
  low-privilege runtime identity, secret manager, egress policy, and OpenAI
  project budget.
- A compromised status producer can publish misleading—but schema-valid—text.
  Keep its mapping small, deterministic, tested, and independently reviewed.
