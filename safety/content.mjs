const SECRET_PATTERNS = [
  /sk-[a-z0-9_-]{12,}/iu,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/u,
  /\b(?:OPENAI_API_KEY|YOUTUBE_REFRESH_TOKEN|YOUTUBE_CLIENT_SECRET)\b/u,
  /\/Users\/[^/\s]+/u,
  /[A-Z]:\\Users\\[^\\\s]+/u,
];
const ALLOWED_URL_PREFIXES = [
  "https://github.com/pablodcruz/ffxi-agents-server",
  "https://github.com/pablodcruz/ffxi-chat-companion",
];

export function sanitizeViewerText(text, maxChars = 500) {
  if (typeof text !== "string") return "";
  return text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxChars);
}

function truncateAtBoundary(text, maxChars) {
  if (text.length <= maxChars) return text;
  const clipped = text.slice(0, Math.max(1, maxChars - 1));
  const boundary = Math.max(
    clipped.lastIndexOf(". "),
    clipped.lastIndexOf("! "),
    clipped.lastIndexOf("? "),
  );
  const safe = boundary >= Math.floor(maxChars * 0.55)
    ? clipped.slice(0, boundary + 1)
    : clipped.trimEnd();
  return `${safe}…`;
}

export function guardReply(rawText, maxChars = 380) {
  if (typeof rawText !== "string") {
    return Object.freeze({ allowed: false, reason: "missing_text", text: null });
  }
  let text = rawText
    .replace(/\r\n?/gu, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, "")
    .trim();
  if (!text) return Object.freeze({ allowed: false, reason: "empty", text: null });
  if (SECRET_PATTERNS.some((pattern) => pattern.test(text))) {
    return Object.freeze({ allowed: false, reason: "sensitive_pattern", text: null });
  }
  const urls = text.match(/https?:\/\/[^\s)]+/gu) || [];
  if (urls.some((url) => !ALLOWED_URL_PREFIXES.some((allowed) => url.startsWith(allowed)))) {
    return Object.freeze({ allowed: false, reason: "unapproved_link", text: null });
  }
  const paragraphs = text
    .split(/\n\s*\n/gu)
    .slice(0, 2)
    .map((paragraph) => paragraph.trim());
  text = paragraphs.join("\n\n").replace(/\n{3,}/gu, "\n\n");
  text = truncateAtBoundary(text, maxChars);
  return Object.freeze({ allowed: true, reason: null, text });
}
