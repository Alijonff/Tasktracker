import assert from "node:assert/strict";
import test from "node:test";

import { readCollapsedState, toggleCollapsedNode, writeCollapsedState } from "@/components/OrganizationTree";

interface MockStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  clear(): void;
}

function createStorage(): MockStorage {
  const store = new Map<string, string>();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
    clear() {
      store.clear();
    },
  };
}

test("OrganizationTree collapsed nodes persist", () => {
  const storage = createStorage();
  const key = "org-tree-test";

  assert.equal(readCollapsedState(key, storage).size, 0);

  const first = toggleCollapsedNode(new Set(), "mgmt");
  writeCollapsedState(key, first, storage);
  assert.equal(storage.getItem(key), "[\"mgmt\"]");

  const restored = readCollapsedState(key, storage);
  assert.equal(restored.has("mgmt"), true);

  const toggled = toggleCollapsedNode(restored, "mgmt");
  writeCollapsedState(key, toggled, storage);
  assert.equal(storage.getItem(key), "[]");
});
