import { createHash } from "node:crypto";

export function privacyPreservingViewerId(channelId, salt) {
  if (!channelId || !salt) throw new Error("Viewer ID hashing requires an ID and salt.");
  return `viewer_${createHash("sha256")
    .update(salt)
    .update("\0")
    .update(channelId)
    .digest("hex")
    .slice(0, 32)}`;
}
