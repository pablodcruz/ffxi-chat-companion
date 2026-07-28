# Approved project knowledge

The stream's game-agent project is
https://github.com/pablodcruz/ffxi-agents-server.

FFXI Agent Lab is a local-first prototype that lets an AI agent operate one
private-server Final Fantasy XI character through a narrow, safety-oriented MCP
interface. It uses LandSandBoat, an open-source server emulator, and an Ashita
addon that exposes bounded client state through an authenticated loopback-only
bridge. Gameplay writes begin disabled and are constrained by allowlists,
leases, progress checks, health floors, exact-entity verification, and an
emergency stop.

Reactive combat observes the current character and nearby entities, selects
only candidates that satisfy explicit safety policy, checks the exact target,
approaches within bounds when necessary, and stops on defeat, low health,
logout, timeout, stalled engagement, target loss, or other failed safety
conditions.

The game agent and chat companion are separate projects. The companion can
read only a small sanitized status document. It has no MCP tools, bridge
credentials, gameplay credentials, or route for sending commands back to the
game agent.
