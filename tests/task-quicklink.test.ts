import { describe, expect, it } from "vitest";

import { createTaskQuicklink } from "../src/lib/task-quicklink";

describe("createTaskQuicklink", () => {
  it("creates an AI Tasks deeplink with an encoded task context", () => {
    expect(
      createTaskQuicklink(
        { id: "task/with spaces?", title: "Summarize webpage", prompt: "Read {browser-tab}", icon: "globe" },
        { ownerOrAuthorName: "owner/name", extensionName: "Prompt Kit" },
      ),
    ).toEqual({
      name: "Summarize webpage",
      icon: "globe-01-16",
      link:
        "raycast://extensions/owner%2Fname/Prompt%20Kit/ai-tasks?context=%7B%22taskId%22%3A%22task%2Fwith%20spaces%3F%22%7D",
    });
  });
});
