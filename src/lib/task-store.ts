import { LocalStorage, showToast, Toast } from "@raycast/api";

import { copyTargetAIOverride, deleteTargetAIOverride, setTargetAIOverride, type AIOverride } from "./ai-settings";
import { ExtensionError } from "./extension-error";
import { DEFAULT_TASK_ICON, isTaskIcon, type AITask, type RunnableTask, type TaskInput } from "../types";

const LEGACY_STORAGE_KEY = "aiTasks.v1";
const LEGACY_RECOVERY_STORAGE_KEY = "promptkit.recovery::aiTasks.v1";
const TASK_STORAGE_PREFIX = "aiTask.v2::";

export type TaskAISettingsInput = {
  override: AIOverride;
};

function taskStorageKey(id: string): string {
  return `${TASK_STORAGE_PREFIX}${encodeURIComponent(id)}`;
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function parseTask(value: unknown): AITask | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const task = value as Record<string, unknown>;
  const title = typeof task.title === "string" ? task.title.trim() : "";
  const prompt = typeof task.prompt === "string" ? task.prompt.trim() : "";
  if (
    typeof task.id !== "string" ||
    !task.id ||
    !title ||
    !prompt ||
    (task.description !== undefined && typeof task.description !== "string") ||
    (task.icon !== undefined && !isTaskIcon(task.icon)) ||
    !isValidDate(task.createdAt) ||
    !isValidDate(task.updatedAt)
  ) {
    return undefined;
  }
  return {
    id: task.id,
    title,
    description: task.description?.trim() || undefined,
    prompt,
    icon: task.icon ?? DEFAULT_TASK_ICON,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

function parseStoredTask(value: LocalStorage.Value): AITask | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  try {
    return parseTask(JSON.parse(value) as unknown);
  } catch {
    return undefined;
  }
}

function normalizeInput(input: TaskInput): TaskInput {
  const title = input.title.trim();
  const prompt = input.prompt.trim();
  if (!title || !prompt || !isTaskIcon(input.icon)) {
    throw new ExtensionError("task-invalid");
  }
  return { title, description: input.description?.trim() || undefined, prompt, icon: input.icon };
}

async function migrateLegacyTasks(): Promise<number> {
  const stored = await LocalStorage.getItem<string>(LEGACY_STORAGE_KEY);
  if (!stored) {
    return 0;
  }

  let value: unknown;
  try {
    value = JSON.parse(stored) as unknown;
  } catch {
    await LocalStorage.setItem(LEGACY_RECOVERY_STORAGE_KEY, stored);
    await LocalStorage.removeItem(LEGACY_STORAGE_KEY);
    return 1;
  }
  if (!Array.isArray(value)) {
    await LocalStorage.setItem(LEGACY_RECOVERY_STORAGE_KEY, stored);
    await LocalStorage.removeItem(LEGACY_STORAGE_KEY);
    return 1;
  }

  const tasks = value.flatMap((candidate) => {
    const task = parseTask(candidate);
    return task ? [task] : [];
  });
  const currentItems = await LocalStorage.allItems();
  await Promise.all(
    tasks.flatMap((task) => {
      const key = taskStorageKey(task.id);
      return key in currentItems ? [] : [writeTaskRecord(task)];
    }),
  );
  await LocalStorage.removeItem(LEGACY_STORAGE_KEY);
  return value.length - tasks.length;
}

async function reportDamagedTasks(count: number): Promise<void> {
  if (count === 0) {
    return;
  }
  await showToast({
    style: Toast.Style.Failure,
    title: "Some tasks could not be loaded",
    message: `Skipped ${count} damaged ${count === 1 ? "task" : "tasks"}.`,
  });
}

async function readTasks(reportDamage = false): Promise<AITask[]> {
  let damagedCount = await migrateLegacyTasks();
  const items = await LocalStorage.allItems();
  const tasks = Object.entries(items).flatMap(([key, value]) => {
    if (!key.startsWith(TASK_STORAGE_PREFIX)) {
      return [];
    }
    const task = parseStoredTask(value);
    if (!task) {
      damagedCount += 1;
      return [];
    }
    return [task];
  });
  if (reportDamage) {
    await reportDamagedTasks(damagedCount);
  }
  return tasks;
}

async function writeTaskRecord(task: AITask): Promise<void> {
  await LocalStorage.setItem(taskStorageKey(task.id), JSON.stringify(task));
}

async function removeTaskRecord(id: string): Promise<void> {
  await LocalStorage.removeItem(taskStorageKey(id));
}

export async function listTasks(): Promise<AITask[]> {
  const tasks = await readTasks(true);
  return tasks.toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function getTask(id: string): Promise<AITask | undefined> {
  await migrateLegacyTasks();
  const stored = await LocalStorage.getItem(taskStorageKey(id));
  return stored === undefined ? undefined : parseStoredTask(stored);
}

export async function saveTask(
  id: string | undefined,
  input: TaskInput,
  aiSettings?: TaskAISettingsInput,
): Promise<AITask> {
  const normalized = normalizeInput(input);
  const previous = id ? await getTask(id) : undefined;
  if (id && !previous) {
    throw new ExtensionError("task-not-found");
  }

  const now = new Date().toISOString();
  const task: AITask = previous
    ? { ...previous, ...normalized, updatedAt: now }
    : { id: crypto.randomUUID(), ...normalized, createdAt: now, updatedAt: now };
  await writeTaskRecord(task);

  try {
    if (
      aiSettings &&
      (previous || aiSettings.override.model?.trim() || aiSettings.override.reasoningEffort !== undefined)
    ) {
      await setTargetAIOverride(task.id, aiSettings.override);
    }
  } catch (error) {
    if (previous) {
      await writeTaskRecord(previous);
    } else {
      await removeTaskRecord(task.id);
    }
    throw error;
  }
  return task;
}

export async function duplicateTask(source: RunnableTask): Promise<AITask> {
  const duplicate = await saveTask(undefined, {
    title: source.title,
    description: source.description,
    prompt: source.prompt,
    icon: source.icon,
  });
  try {
    await copyTargetAIOverride(source.id, duplicate.id);
    return duplicate;
  } catch (error) {
    await removeTaskRecord(duplicate.id);
    throw error;
  }
}

export async function removeTask(id: string): Promise<void> {
  const task = await getTask(id);
  if (!task) {
    throw new ExtensionError("task-not-found");
  }
  await removeTaskRecord(id);
  try {
    await deleteTargetAIOverride(id);
  } catch (error) {
    await writeTaskRecord(task);
    throw error;
  }
}
