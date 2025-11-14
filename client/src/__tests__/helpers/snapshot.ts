import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

const SNAPSHOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "../__snapshots__");
const shouldUpdateSnapshot = process.env.UPDATE_SNAPSHOTS === "1";

export function expectToMatchSnapshot(name: string, actual: string) {
  const filePath = join(SNAPSHOT_DIR, `${name}.snap`);
  if (!existsSync(filePath)) {
    mkdirSync(SNAPSHOT_DIR, { recursive: true });
    writeFileSync(filePath, actual);
    return;
  }
  const expected = readFileSync(filePath, "utf8");
  const normalizedActual = normalize(actual);
  const normalizedExpected = normalize(expected);

  if (normalizedActual === normalizedExpected) {
    return;
  }

  if (shouldUpdateSnapshot) {
    writeFileSync(filePath, actual);
    return;
  }

  assert.equal(normalizedActual, normalizedExpected, `Snapshot mismatch for ${name}`);
}
