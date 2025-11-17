import fs from "fs";
import path from "path";
import {
  DEFAULT_TASK_METADATA,
  type TaskMetadata,
  normalizeTaskMode,
  normalizeTaskType,
} from "@shared/taskMetadata";

const metadataFilePath = path.resolve(process.cwd(), "server", "taskMetadata.json");
let cache: Record<string, TaskMetadata> | null = null;

function ensureLoaded() {
  if (cache) return;
  try {
    const raw = fs.readFileSync(metadataFilePath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, TaskMetadata>;
    cache = Object.fromEntries(
      Object.entries(parsed).map(([taskId, meta]) => [taskId, normalizeMetadata(meta)]),
    );
  } catch (error) {
    cache = {};
  }
}

function persist() {
  if (!cache) return;
  fs.mkdirSync(path.dirname(metadataFilePath), { recursive: true });
  fs.writeFileSync(metadataFilePath, JSON.stringify(cache, null, 2), "utf-8");
}

function normalizeMetadata(meta: Partial<TaskMetadata> | undefined): TaskMetadata {
  if (!meta) return { ...DEFAULT_TASK_METADATA };
  return {
    mode: normalizeTaskMode(meta.mode),
    taskType: normalizeTaskType(meta.taskType),
  };
}

export function getTaskMetadata(taskId: string): TaskMetadata {
  ensureLoaded();
  return cache?.[taskId] ? normalizeMetadata(cache[taskId]) : { ...DEFAULT_TASK_METADATA };
}

export function setTaskMetadata(taskId: string, metadata: Partial<TaskMetadata>): TaskMetadata {
  ensureLoaded();
  const normalized = normalizeMetadata(metadata);
  if (cache) {
    cache[taskId] = normalized;
    persist();
  }
  return normalized;
}

export function deleteTaskMetadata(taskId: string): void {
  ensureLoaded();
  if (cache && cache[taskId]) {
    delete cache[taskId];
    persist();
  }
}

export function mergeTaskMetadata(taskId: string, metadata: Partial<TaskMetadata>): TaskMetadata {
  ensureLoaded();
  const existing = getTaskMetadata(taskId);
  const merged: TaskMetadata = {
    mode: normalizeTaskMode(metadata.mode ?? existing.mode),
    taskType: normalizeTaskType(metadata.taskType ?? existing.taskType),
  };
  if (cache) {
    cache[taskId] = merged;
    persist();
  }
  return merged;
}

export function ensureMetadata(taskId: string): TaskMetadata {
  ensureLoaded();
  if (cache?.[taskId]) return cache[taskId];
  const meta = { ...DEFAULT_TASK_METADATA };
  if (cache) {
    cache[taskId] = meta;
    persist();
  }
  return meta;
}
