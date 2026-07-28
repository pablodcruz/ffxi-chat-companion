function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function parseIntent(text, mentionAliases) {
  const trimmed = text.trim();
  const command = /^!(status|zone|why|project|help)(?:\s|$)/iu.exec(trimmed);
  if (command) return Object.freeze({ kind: "command", name: command[1].toLowerCase() });

  for (const alias of mentionAliases) {
    const mention = new RegExp(`@${escapeRegex(alias)}\\b`, "iu");
    if (!mention.test(trimmed)) continue;
    const question = trimmed.replace(mention, "").trim().replace(/^[:,\-–—]\s*/u, "");
    if (!question) return Object.freeze({ kind: "command", name: "help" });
    return Object.freeze({ kind: "ai", question });
  }
  return null;
}
