const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

function booleanValue(env, name, fallback) {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const normalized = raw.toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  throw new Error(`${name} must be true or false.`);
}

function integerValue(env, name, fallback, { min, max }) {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer from ${min} through ${max}.`);
  }
  return parsed;
}

function listValue(raw, fallback) {
  const values = (raw || fallback)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (values.length === 0) throw new Error("At least one bot mention alias is required.");
  return [...new Set(values)];
}

function optional(raw) {
  const value = raw?.trim();
  return value ? value : null;
}

export function loadConfig(env = process.env) {
  const statusSource = (env.STATUS_SOURCE || "none").trim().toLowerCase();
  if (!["none", "file", "http"].includes(statusSource)) {
    throw new Error("STATUS_SOURCE must be none, file, or http.");
  }

  const config = {
    dryRun: booleanValue(env, "DRY_RUN", true),
    aiEnabled: booleanValue(env, "AI_ENABLED", false),
    botDisplayName: env.BOT_DISPLAY_NAME?.trim() || "Kupobot",
    mentionAliases: listValue(
      env.BOT_MENTION_ALIASES,
      env.BOT_DISPLAY_NAME?.trim() || "Kupobot",
    ),
    projectUrl:
      env.PROJECT_URL?.trim()
      || "https://github.com/pablodcruz/ffxi-agents-server",
    companionUrl:
      env.COMPANION_URL?.trim()
      || "https://github.com/pablodcruz/ffxi-chat-companion",
    youtube: {
      clientId: optional(env.YOUTUBE_CLIENT_ID),
      clientSecret: optional(env.YOUTUBE_CLIENT_SECRET),
      refreshToken: optional(env.YOUTUBE_REFRESH_TOKEN),
      botChannelId: optional(env.YOUTUBE_BOT_CHANNEL_ID),
      liveChatId: optional(env.YOUTUBE_LIVE_CHAT_ID),
    },
    openai: {
      apiKey: optional(env.OPENAI_API_KEY),
      model: env.OPENAI_MODEL?.trim() || "gpt-5.6-luna",
      safetyHashSalt: optional(env.SAFETY_HASH_SALT),
    },
    limits: {
      viewerCooldownMs:
        integerValue(env, "VIEWER_COOLDOWN_SECONDS", 45, { min: 30, max: 60 })
        * 1_000,
      globalAiPerMinute: integerValue(
        env,
        "GLOBAL_AI_REPLIES_PER_MINUTE",
        3,
        { min: 1, max: 3 },
      ),
      globalRepliesPerMinute: integerValue(
        env,
        "GLOBAL_REPLIES_PER_MINUTE",
        10,
        { min: 1, max: 20 },
      ),
      duplicateWindowMs:
        integerValue(env, "DUPLICATE_WINDOW_SECONDS", 20, { min: 5, max: 120 })
        * 1_000,
      maxInputChars: integerValue(env, "MAX_INPUT_CHARS", 500, {
        min: 50,
        max: 1_000,
      }),
      maxReplyChars: integerValue(env, "MAX_REPLY_CHARS", 380, {
        min: 80,
        max: 500,
      }),
    },
    status: {
      source: statusSource,
      file: env.STATUS_FILE?.trim() || "runtime/status-v1.json",
      url: optional(env.STATUS_URL),
      bearerToken: optional(env.STATUS_BEARER_TOKEN),
      maxAgeMs:
        integerValue(env, "STATUS_MAX_AGE_SECONDS", 120, {
          min: 10,
          max: 3_600,
        }) * 1_000,
    },
  };

  validateConfig(config);
  return config;
}

export function validateConfig(config) {
  const oauthValues = [
    config.youtube.clientId,
    config.youtube.clientSecret,
    config.youtube.refreshToken,
  ];
  if (oauthValues.some(Boolean) && !oauthValues.every(Boolean)) {
    throw new Error(
      "YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REFRESH_TOKEN "
      + "must be configured together.",
    );
  }
  if (!config.dryRun && !config.youtube.botChannelId) {
    throw new Error("YOUTUBE_BOT_CHANNEL_ID is required when DRY_RUN=false.");
  }
  if (config.aiEnabled) {
    if (!config.openai.apiKey) {
      throw new Error("OPENAI_API_KEY is required when AI_ENABLED=true.");
    }
    if (!config.openai.safetyHashSalt || config.openai.safetyHashSalt.length < 32) {
      throw new Error(
        "SAFETY_HASH_SALT must contain at least 32 characters when AI_ENABLED=true.",
      );
    }
  }
  if (config.status.source === "http" && !config.status.url) {
    throw new Error("STATUS_URL is required when STATUS_SOURCE=http.");
  }
}

export function validateYouTubeRuntimeConfig(config) {
  if (!config.youtube.clientId
      || !config.youtube.clientSecret
      || !config.youtube.refreshToken) {
    throw new Error(
      "YouTube service startup requires YOUTUBE_CLIENT_ID, "
      + "YOUTUBE_CLIENT_SECRET, and YOUTUBE_REFRESH_TOKEN.",
    );
  }
}
