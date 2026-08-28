import { beforeEach, describe, expect, it } from "vitest";

import { __failNextLocalStorageOperation, __getToasts, __resetRaycast, __setLocalStorage } from "./stubs/raycast-api";
import { getProviderAISettings } from "../src/lib/ai-settings";
import { duplicateTask, getTask, listTasks, removeTask, saveTask } from "../src/lib/task-store";

beforeEach(() => {
  __resetRaycast();
});

describe("task store", () => {
  it("creates, retrieves, updates, and deletes a trimmed task", async () => {
    const created = await saveTask(undefined, {
      title: "  Weekly summary  ",
      description: "  Keep this short  ",
      prompt: "  Summarize {input}  ",
      icon: "stars",
    });

    expect(created).toMatchObject({
      title: "Weekly summary",
      description: "Keep this short",
      prompt: "Summarize {input}",
      icon: "stars",
    });
    expect(created.id).toEqual(expect.any(String));
    await expect(getTask(created.id)).resolves.toEqual(created);

    const updated = await saveTask(created.id, {
      title: "New title",
      description: " ",
      prompt: "New prompt",
      icon: "code",
    });
    expect(updated).toMatchObject({
      id: created.id,
      title: "New title",
      description: undefined,
      prompt: "New prompt",
      icon: "code",
    });
    expect(updated.createdAt).toBe(created.createdAt);

    await removeTask(created.id);
    await expect(getTask(created.id)).resolves.toBeUndefined();
  });

  it("rejects invalid task input and missing updates", async () => {
    await expect(saveTask(undefined, { title: " ", prompt: "Prompt", icon: "text" })).rejects.toMatchObject({
      code: "task-invalid",
    });
    await expect(saveTask(undefined, { title: "Title", prompt: " ", icon: "text" })).rejects.toMatchObject({
      code: "task-invalid",
    });
    await expect(saveTask("missing", { title: "Title", prompt: "Prompt", icon: "text" })).rejects.toMatchObject({
      code: "task-not-found",
    });
  });

  it("keeps concurrently created tasks", async () => {
    await Promise.all([
      saveTask(undefined, { title: "First", prompt: "First prompt", icon: "text" }),
      saveTask(undefined, { title: "Second", prompt: "Second prompt", icon: "stars" }),
    ]);

    await expect(listTasks()).resolves.toHaveLength(2);
  });

  it("does not persist an empty override for a new task", async () => {
    __failNextLocalStorageOperation("removeItem", "aiOverride.v1::");

    const task = await saveTask(
      undefined,
      { title: "Inherited settings", prompt: "Use the defaults", icon: "text" },
      { override: {} },
    );

    await expect(getTask(task.id)).resolves.toEqual(task);
  });

  it("duplicates a task and its AI override", async () => {
    const original = await saveTask(
      undefined,
      { title: "Reusable task", description: "Description", prompt: "Process {input}", icon: "wand" },
      { override: { model: "task-model", reasoningEffort: "high" } },
    );

    const duplicate = await duplicateTask(original);

    expect(duplicate).toMatchObject({
      title: original.title,
      description: original.description,
      prompt: original.prompt,
      icon: original.icon,
    });
    expect(duplicate.id).not.toBe(original.id);
    await expect(getProviderAISettings()).resolves.toMatchObject({
      overrides: {
        [original.id]: { model: "task-model", reasoningEffort: "high" },
        [duplicate.id]: { model: "task-model", reasoningEffort: "high" },
      },
    });
  });

  it("rolls back a new task when its AI override cannot be saved", async () => {
    __failNextLocalStorageOperation("setItem", "aiOverride.v1::");

    await expect(
      saveTask(
        undefined,
        { title: "Rollback", prompt: "Do this", icon: "text" },
        { override: { model: "task-model" } },
      ),
    ).rejects.toThrow("LocalStorage setItem failed");
    await expect(listTasks()).resolves.toEqual([]);
  });

  it("restores a task when removing its overrides fails", async () => {
    const task = await saveTask(
      undefined,
      { title: "Keep me", prompt: "Do this", icon: "text" },
      { override: { model: "task-model" } },
    );
    __failNextLocalStorageOperation("removeItem", "aiOverride.v1::");

    await expect(removeTask(task.id)).rejects.toThrow("LocalStorage removeItem failed");
    await expect(getTask(task.id)).resolves.toEqual(task);
    await expect(getProviderAISettings()).resolves.toMatchObject({
      overrides: { [task.id]: { model: "task-model" } },
    });
  });

  it("migrates legacy tasks and fills their missing icon", async () => {
    __setLocalStorage(
      "aiTasks.v1",
      JSON.stringify([
        {
          id: "valid",
          title: "Valid task",
          prompt: "Do this",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
        { id: 4, title: "Broken" },
      ]),
    );

    await expect(listTasks()).resolves.toEqual([
      {
        id: "valid",
        title: "Valid task",
        prompt: "Do this",
        icon: "text",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
    expect(__getToasts()).toEqual([
      expect.objectContaining({ title: "Some tasks could not be loaded", message: "Skipped 1 damaged task." }),
    ]);
  });

  it("quarantines malformed legacy task storage after reporting it once", async () => {
    __setLocalStorage("aiTasks.v1", "not-json");

    await expect(listTasks()).resolves.toEqual([]);
    await expect(listTasks()).resolves.toEqual([]);

    expect(__getToasts()).toEqual([
      expect.objectContaining({ title: "Some tasks could not be loaded", message: "Skipped 1 damaged task." }),
    ]);
  });
});
