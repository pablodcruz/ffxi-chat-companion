import { readFile } from "node:fs/promises";

const APPROVED_FILES = [
  new URL("./project.md", import.meta.url),
  new URL("./ffxi.md", import.meta.url),
];

export async function loadApprovedKnowledge() {
  const sections = await Promise.all(
    APPROVED_FILES.map((file) => readFile(file, "utf8")),
  );
  return sections.join("\n\n").trim();
}
