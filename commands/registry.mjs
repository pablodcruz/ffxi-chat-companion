function unavailable(label) {
  return `The read-only adventure feed is unavailable, so I can't report ${label} without guessing, kupo!`;
}

function stale(label) {
  return `The adventure feed is stale, so I won't claim the current ${label}. Please try again shortly, kupo!`;
}

function withFreshStatus(status, label, render) {
  if (!status?.available) return unavailable(label);
  if (status.stale) return stale(label);
  return render(status.value);
}

export function createCommands({
  botDisplayName = "Kupobot",
  projectUrl,
  companionUrl,
}) {
  return new Map([
    ["help", async () =>
      `I'm ${botDisplayName}, an AI chat companion. Commands: !status, !zone, !why, !project, !help. Mention @${botDisplayName} for a short project or adventure question.`],
    ["project", async () =>
      `I'm ${botDisplayName}, an unofficial AI chat companion for the FFXI Agent Lab. Game agent: ${projectUrl} Companion: ${companionUrl}`],
    ["status", async ({ status }) => withFreshStatus(
      status,
      "objective or agent state",
      (value) => {
        const objective = value.objective || "No objective reported";
        const action = value.recent_action || "no recent action reported";
        const health = value.health_status || "unknown";
        return `Objective: ${objective}. Current state: ${health}; ${action}.`;
      },
    )],
    ["zone", async ({ status }) => withFreshStatus(
      status,
      "zone",
      (value) => {
        const zone = value.zone;
        if (!zone?.name && zone?.id === null) return unavailable("zone");
        return `Current zone: ${zone.name || "unknown"}${zone.id !== null ? ` (ID ${zone.id})` : ""}.`;
      },
    )],
    ["why", async ({ status }) => withFreshStatus(
      status,
      "reason for the current action",
      (value) => value.reason
        ? `Why: ${value.reason}`
        : "The sanitized feed doesn't include a reason for the current action, so I won't invent one, kupo!",
    )],
  ]);
}
