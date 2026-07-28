const ALLOWED_FIELDS = new Set([
  "event",
  "kind",
  "reason",
  "count",
  "dry_run",
  "delay_ms",
  "status_source",
]);

function safeRecord(record) {
  return Object.fromEntries(
    Object.entries(record).filter(
      ([key, value]) =>
        ALLOWED_FIELDS.has(key)
        && ["string", "number", "boolean"].includes(typeof value),
    ),
  );
}

export function createLogger(output = console) {
  return {
    info(record) {
      output.log(JSON.stringify({
        level: "info",
        at: new Date().toISOString(),
        ...safeRecord(record),
      }));
    },
    error(record) {
      output.error(JSON.stringify({
        level: "error",
        at: new Date().toISOString(),
        ...safeRecord(record),
      }));
    },
  };
}
