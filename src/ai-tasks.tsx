import {
  Action,
  ActionPanel,
  Alert,
  confirmAlert,
  Detail,
  Icon,
  launchCommand,
  type LaunchProps,
  LaunchType,
  List,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useState } from "react";

import { BUILT_IN_TASKS, type RunnableTask } from "./lib/built-in-tasks";
import { createTaskQuicklink } from "./lib/task-quicklink";
import { getTaskIcon } from "./lib/task-icons";
import { duplicateTask, getTask, listTasks, removeTask } from "./lib/task-store";
import type { AITask } from "./types";
import { AIResult } from "./ui/ai-result";
import { TaskForm } from "./ui/task-form";
import { TextInputForm } from "./ui/text-input-form";
import { TargetAISettingsAction } from "./ui/target-ai-settings";

type TaskItem = { kind: "custom"; task: AITask } | { kind: "built-in"; task: RunnableTask };

type CommonTaskActionsProps = {
  onRun: () => void;
  onCreate: () => void;
  onDuplicate: () => void;
};

type TaskActionsProps = CommonTaskActionsProps &
  (
    | { kind: "custom"; task: AITask; onEdit: () => void; onDelete: () => void }
    | { kind: "built-in"; task: RunnableTask }
  );

function TaskActions(props: TaskActionsProps) {
  const { onRun, onCreate, onDuplicate } = props;
  const { task } = props;
  return (
    <ActionPanel title={task.title}>
      <Action title="Run task" icon={Icon.Play} onAction={onRun} />
      <Action title="Create task" icon={Icon.Plus} onAction={onCreate} />
      {props.kind === "custom" ? (
        <Action title="Edit task" icon={Icon.Pencil} onAction={props.onEdit} />
      ) : (
        <TargetAISettingsAction task={task} />
      )}
      <Action title="Duplicate task" icon={Icon.Duplicate} onAction={onDuplicate} />
      <Action.CreateQuicklink title="Create Quicklink" icon={Icon.Quicklink} quicklink={createTaskQuicklink(task)} />
      {props.kind === "custom" ? (
        <Action title="Delete task" icon={Icon.Trash} style={Action.Style.Destructive} onAction={props.onDelete} />
      ) : null}
    </ActionPanel>
  );
}

function TaskList() {
  const { push, pop } = useNavigation();
  const { data: tasks = [], isLoading, revalidate } = useCachedPromise(listTasks);

  const createNewTask = () => {
    push(
      <TaskForm
        onSaved={async () => {
          await revalidate();
          await showToast({ style: Toast.Style.Success, title: "Task created" });
          pop();
        }}
      />,
    );
  };

  const editTask = (task: AITask) => {
    push(
      <TaskForm
        task={task}
        onSaved={async () => {
          await revalidate();
          await showToast({ style: Toast.Style.Success, title: "Task saved" });
          pop();
        }}
      />,
    );
  };

  const runTask = (item: TaskItem) => {
    const { task } = item;
    const result = (input?: string) => (
      <AIResult task={task} input={input} onEditTask={item.kind === "custom" ? () => editTask(item.task) : undefined} />
    );
    if (task.prompt.includes("{input}")) {
      push(
        <TextInputForm
          title={task.title}
          placeholder="Enter the task input"
          submitTitle="Run task"
          onSubmit={(input) => push(result(input))}
          settingsTask={item.kind === "built-in" ? task : undefined}
        />,
      );
      return;
    }
    push(result());
  };

  const duplicateSavedTask = async (task: RunnableTask) => {
    await duplicateTask(task);
    await revalidate();
    await showToast({ style: Toast.Style.Success, title: "Task duplicated" });
  };

  const removeSavedTask = async (task: AITask) => {
    const confirmed = await confirmAlert({
      title: `Delete "${task.title}"?`,
      message: "This removes the task from PromptKit.",
      primaryAction: { title: "Delete task", style: Alert.ActionStyle.Destructive },
      dismissAction: { title: "Cancel", style: Alert.ActionStyle.Cancel },
    });
    if (!confirmed) {
      return;
    }
    await removeTask(task.id);
    await revalidate();
    await showToast({ style: Toast.Style.Success, title: "Task deleted" });
  };

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search tasks">
      <List.Section title="Custom tasks">
        {tasks.length === 0 ? (
          <List.Item
            icon={Icon.PlusCircle}
            title="No custom tasks yet"
            subtitle="Create a task to reuse your own prompt."
            actions={
              <ActionPanel>
                <Action title="Create task" icon={Icon.Plus} onAction={createNewTask} />
              </ActionPanel>
            }
          />
        ) : (
          tasks.map((task) => (
            <List.Item
              key={task.id}
              icon={getTaskIcon(task.icon)}
              title={task.title}
              subtitle={task.description}
              actions={
                <TaskActions
                  kind="custom"
                  task={task}
                  onRun={() => runTask({ kind: "custom", task })}
                  onCreate={createNewTask}
                  onEdit={() => editTask(task)}
                  onDuplicate={() => void duplicateSavedTask(task)}
                  onDelete={() => void removeSavedTask(task)}
                />
              }
            />
          ))
        )}
      </List.Section>
      <List.Section title="Examples">
        {BUILT_IN_TASKS.map((task) => (
          <List.Item
            key={task.id}
            icon={getTaskIcon(task.icon)}
            title={task.title}
            subtitle={task.description}
            actions={
              <TaskActions
                kind="built-in"
                task={task}
                onRun={() => runTask({ kind: "built-in", task })}
                onCreate={createNewTask}
                onDuplicate={() => void duplicateSavedTask(task)}
              />
            }
          />
        ))}
      </List.Section>
    </List>
  );
}

function LaunchedTask({ taskId }: { taskId: string }) {
  const { push, pop } = useNavigation();
  const builtInTask = BUILT_IN_TASKS.find((task) => task.id === taskId);
  const { data: customTask, isLoading, revalidate } = useCachedPromise(getTask, [taskId]);
  const [input, setInput] = useState<string>();
  const item: TaskItem | undefined = builtInTask
    ? { kind: "built-in", task: builtInTask }
    : customTask
      ? { kind: "custom", task: customTask }
      : undefined;
  const task = item?.task;

  if (!task && isLoading) {
    return <Detail isLoading markdown="# Opening task\n\nLoading the saved task..." />;
  }

  if (!task) {
    return (
      <Detail
        markdown="# Task not found\n\nThis Quicklink points to a task that no longer exists. Delete the Quicklink or create a new task."
        actions={
          <ActionPanel>
            <Action
              title="Open AI Tasks"
              icon={Icon.List}
              onAction={() => void launchCommand({ name: "ai-tasks", type: LaunchType.UserInitiated })}
            />
          </ActionPanel>
        }
      />
    );
  }

  if (task.prompt.includes("{input}") && input === undefined) {
    return (
      <TextInputForm
        title={task.title}
        placeholder="Enter the task input"
        submitTitle="Run task"
        onSubmit={setInput}
        settingsTask={item.kind === "built-in" ? task : undefined}
      />
    );
  }

  const editTask =
    item.kind === "custom"
      ? () =>
          push(
            <TaskForm
              task={item.task}
              onSaved={async () => {
                await revalidate();
                await showToast({ style: Toast.Style.Success, title: "Task saved" });
                pop();
              }}
            />,
          )
      : undefined;

  return <AIResult task={task} input={input} onEditTask={editTask} />;
}

export default function AITasks(props: LaunchProps) {
  const taskId = typeof props.launchContext?.taskId === "string" ? props.launchContext.taskId.trim() : "";
  return taskId ? <LaunchedTask taskId={taskId} /> : <TaskList />;
}
