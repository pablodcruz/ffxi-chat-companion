const ROOT_KEYS = new Set([
  "schema_version",
  "updated_at",
  "zone",
  "objective",
  "job",
  "health_status",
  "recent_action",
  "reason",
]);
const ZONE_KEYS = new Set(["id", "name"]);
const JOB_KEYS = new Set(["name", "level"]);
const HEALTH_VALUES = new Set([
  "healthy",
  "caution",
  "critical",
  "defeated",
  "unknown",
]);

function plainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function rejectUnexpectedKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${label} contains unexpected field ${key}.`);
  }
}

function nullableText(value, label, maxLength) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error(`${label} must be text or null.`);
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) {
    throw new Error(`${label} must contain 1-${maxLength} characters.`);
  }
  if (/[\u0000-\u001f\u007f]/u.test(trimmed)) {
    throw new Error(`${label} contains control characters.`);
  }
  return trimmed;
}

function parseZone(value) {
  if (value === null || value === undefined) return null;
  const zone = plainObject(value, "zone");
  rejectUnexpectedKeys(zone, ZONE_KEYS, "zone");
  const id = zone.id;
  if (id !== null && id !== undefined
      && (!Number.isSafeInteger(id) || id < 0 || id > 999)) {
    throw new Error("zone.id must be an integer from 0 through 999 or null.");
  }
  return {
    id: id ?? null,
    name: nullableText(zone.name, "zone.name", 80),
  };
}

function parseJob(value) {
  if (value === null || value === undefined) return null;
  const job = plainObject(value, "job");
  rejectUnexpectedKeys(job, JOB_KEYS, "job");
  const level = job.level;
  if (level !== null && level !== undefined
      && (!Number.isSafeInteger(level) || level < 1 || level > 99)) {
    throw new Error("job.level must be an integer from 1 through 99 or null.");
  }
  return {
    name: nullableText(job.name, "job.name", 40),
    level: level ?? null,
  };
}

export function parsePublicStatus(value) {
  const status = plainObject(value, "status");
  rejectUnexpectedKeys(status, ROOT_KEYS, "status");
  if (status.schema_version !== 1) {
    throw new Error("status.schema_version must equal 1.");
  }
  if (typeof status.updated_at !== "string") {
    throw new Error("status.updated_at must be an ISO-8601 string.");
  }
  const updatedAtMs = Date.parse(status.updated_at);
  if (!Number.isFinite(updatedAtMs)) {
    throw new Error("status.updated_at must be a valid ISO-8601 timestamp.");
  }
  const healthStatus = status.health_status ?? "unknown";
  if (!HEALTH_VALUES.has(healthStatus)) {
    throw new Error("status.health_status is not allowlisted.");
  }

  return Object.freeze({
    schema_version: 1,
    updated_at: new Date(updatedAtMs).toISOString(),
    zone: parseZone(status.zone),
    objective: nullableText(status.objective, "status.objective", 160),
    job: parseJob(status.job),
    health_status: healthStatus,
    recent_action: nullableText(status.recent_action, "status.recent_action", 160),
    reason: nullableText(status.reason, "status.reason", 200),
  });
}
