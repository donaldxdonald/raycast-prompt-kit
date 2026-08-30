import { Action, ActionPanel, Detail, Icon, Keyboard } from "@raycast/api";
import { useCallback, useEffect, useRef, useState } from "react";

import { runAITask } from "../lib/ai-runner";
import { toExtensionError, type ExtensionError } from "../lib/extension-error";
import type { AITaskDefinition, PlaceholderName } from "../types";
import { TargetAISettingsAction } from "./target-ai-settings";
import { OpenAISettingsAction } from "./open-ai-settings-action";

type AIResultProps = {
  task: AITaskDefinition;
  input?: string;
  onEditTask?: () => void;
};

type ResultState =
  | { status: "loading"; text: string }
  | { status: "success"; text: string; truncatedSources: PlaceholderName[] }
  | { status: "cancelled"; text: string }
  | { status: "failure"; text: string; error: ExtensionError };

function closeUnterminatedFences(text: string): string {
  const fences = text.match(/```/g)?.length ?? 0;
  return fences % 2 === 1 ? `${text}\n\`\`\`` : text;
}

function resultMarkdown(state: ResultState): string {
  const truncationNotice =
    state.status === "success" && state.truncatedSources.length > 0
      ? `\n\n---\n\nSome input was shortened to match the configured source limit. Shortened sources: ${state.truncatedSources
          .map((source) => `\`{${source}}\``)
          .join(", ")}.`
      : "";

  switch (state.status) {
    case "loading":
      return closeUnterminatedFences(state.text);
    case "success":
      return `${state.text}${truncationNotice}`;
    case "cancelled":
      return state.text
        ? `${state.text}\n\n---\n\nGeneration cancelled.`
        : "# Request cancelled\n\nRun the task again to start a new request.";
    case "failure":
      return state.text
        ? `${state.text}\n\n---\n\n**Generation stopped:** ${state.error.message}`
        : `# Unable to generate a result\n\n${state.error.message}`;
  }
}

export function AIResult({ task, input, onEditTask }: AIResultProps) {
  const [state, setState] = useState<ResultState>({ status: "loading", text: "" });
  const activeRequest = useRef<{ id: number; controller: AbortController } | undefined>(undefined);
  const nextRequestId = useRef(0);

  const regenerate = useCallback(async () => {
    activeRequest.current?.controller.abort();
    const request = {
      id: ++nextRequestId.current,
      controller: new AbortController(),
    };
    activeRequest.current = request;
    setState({ status: "loading", text: "" });

    try {
      const result = await runAITask({
        task,
        input,
        signal: request.controller.signal,
        onDelta(delta) {
          if (activeRequest.current?.id === request.id && !request.controller.signal.aborted) {
            setState((current) =>
              current.status === "loading" ? { ...current, text: current.text + delta } : current,
            );
          }
        },
      });
      if (activeRequest.current?.id === request.id && !request.controller.signal.aborted) {
        setState({ status: "success", text: result.text, truncatedSources: result.truncatedSources });
      }
    } catch (error) {
      if (activeRequest.current?.id === request.id) {
        const extensionError = toExtensionError(error);
        setState((current) =>
          extensionError.code === "cancelled"
            ? { status: "cancelled", text: current.text }
            : { status: "failure", text: current.text, error: extensionError },
        );
      }
    }
  }, [input, task.id, task.prompt, task.title]);

  useEffect(() => {
    void regenerate();
    return () => {
      activeRequest.current?.controller.abort();
      activeRequest.current = undefined;
    };
  }, [regenerate]);

  const waitingForFirstToken = state.status === "loading" && !state.text;

  return (
    <Detail
      navigationTitle={task.title}
      isLoading={state.status === "loading"}
      markdown={resultMarkdown(state)}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            {state.status === "loading" ? (
              <Action
                title="Cancel generation"
                icon={Icon.Stop}
                onAction={() => activeRequest.current?.controller.abort()}
              />
            ) : null}
            {state.text ? <Action.CopyToClipboard title="Copy result" content={state.text} /> : null}
            {state.text ? <Action.Paste title="Paste result" content={state.text} /> : null}
            {waitingForFirstToken ? null : (
              <Action
                title="Regenerate"
                icon={Icon.ArrowClockwise}
                shortcut={Keyboard.Shortcut.Common.Refresh}
                onAction={() => void regenerate()}
              />
            )}
          </ActionPanel.Section>
          <ActionPanel.Section>
            {onEditTask ? <Action title="Edit task" icon={Icon.Pencil} onAction={onEditTask} /> : null}
            {!onEditTask ? <TargetAISettingsAction task={task} /> : null}
            <OpenAISettingsAction />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
