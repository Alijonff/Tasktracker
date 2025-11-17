export const TASK_MODES = ["MONEY", "TIME"] as const;
export type TaskMode = (typeof TASK_MODES)[number];

export const TASK_TYPES = ["INDIVIDUAL", "UNIT", "DEPARTMENT"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export interface TaskMetadata {
  mode: TaskMode;
  taskType: TaskType;
}

export const DEFAULT_TASK_METADATA: TaskMetadata = {
  mode: "MONEY",
  taskType: "DEPARTMENT",
};

export function normalizeTaskMode(value: unknown): TaskMode {
  return TASK_MODES.includes(value as TaskMode) ? (value as TaskMode) : DEFAULT_TASK_METADATA.mode;
}

export function normalizeTaskType(value: unknown): TaskType {
  return TASK_TYPES.includes(value as TaskType) ? (value as TaskType) : DEFAULT_TASK_METADATA.taskType;
}

export function isTimeMode(mode: TaskMode): boolean {
  return mode === "TIME";
}
