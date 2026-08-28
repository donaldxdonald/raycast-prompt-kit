import { environment } from "@raycast/api";

import type { RunnableTask } from "../types";
import { getTaskIcon } from "./task-icons";

type QuicklinkEnvironment = Pick<typeof environment, "ownerOrAuthorName" | "extensionName">;

export function createTaskQuicklink(
  task: RunnableTask,
  currentEnvironment: QuicklinkEnvironment = environment,
): { name: string; link: string; icon: ReturnType<typeof getTaskIcon> } {
  const context = encodeURIComponent(JSON.stringify({ taskId: task.id }));
  const owner = encodeURIComponent(currentEnvironment.ownerOrAuthorName);
  const extension = encodeURIComponent(currentEnvironment.extensionName);
  return {
    name: task.title,
    icon: getTaskIcon(task.icon),
    link: `raycast://extensions/${owner}/${extension}/ai-tasks?context=${context}`,
  };
}
