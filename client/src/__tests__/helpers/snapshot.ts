import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

const SNAPSHOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "../__snapshots__");

export function expectToMatchSnapshot(name: string, actual: string) {
  const filePath = join(SNAPSHOT_DIR, `${name}.snap`);
  if (!existsSync(filePath)) {
    mkdirSync(SNAPSHOT_DIR, { recursive: true });
    writeFileSync(filePath, actual);
    return;
  }
  const expected = readFileSync(filePath, "utf8");
  assert.equal(normalize(actual), normalize(expected), `Snapshot mismatch for ${name}`);
}
