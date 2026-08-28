import { Action, ActionPanel, Detail, Form } from "@raycast/api";
import { useForm } from "@raycast/utils";
import { useEffect, useState } from "react";

import { resolveTextInput, type TextInputResolution } from "../lib/input-source";
import type { AITaskDefinition } from "../types";
import { AIResult } from "./ai-result";
import { TargetAISettingsAction } from "./target-ai-settings";

type TextInputFormProps = {
  title: string;
  placeholder: string;
  submitTitle: string;
  onSubmit: (text: string) => void | Promise<void>;
  settingsTask?: AITaskDefinition;
};

type TextFormValues = {
  text: string;
};

export function TextInputForm({ title, placeholder, submitTitle, onSubmit, settingsTask }: TextInputFormProps) {
  const { handleSubmit, itemProps } = useForm<TextFormValues>({
    async onSubmit(values) {
      await onSubmit(values.text.trim());
    },
    validation: {
      text: (value) => (value?.trim() ? undefined : "Enter some text to continue."),
    },
  });

  return (
    <Form
      navigationTitle={title}
      actions={
        <ActionPanel>
          <Action.SubmitForm title={submitTitle} onSubmit={handleSubmit} />
          {settingsTask ? <TargetAISettingsAction task={settingsTask} /> : null}
        </ActionPanel>
      }
    >
      <Form.TextArea title="Text" placeholder={placeholder} {...itemProps.text} />
    </Form>
  );
}

type TextInputCommandProps = {
  argument?: string;
  task: AITaskDefinition;
  placeholder: string;
};

export function TextInputCommand({ argument, task, placeholder }: TextInputCommandProps) {
  const [resolution, setResolution] = useState<TextInputResolution>();

  useEffect(() => {
    let active = true;
    void resolveTextInput(argument).then((result) => {
      if (active) {
        setResolution(result);
      }
    });
    return () => {
      active = false;
    };
  }, [argument]);

  if (!resolution) {
    return <Detail isLoading markdown={`# ${task.title}\n\nChecking for selected text...`} />;
  }
  if (resolution.kind === "ready") {
    return <AIResult task={task} input={resolution.text} />;
  }
  return (
    <TextInputForm
      title={task.title}
      placeholder={placeholder}
      submitTitle={task.title}
      settingsTask={task}
      onSubmit={(text) => setResolution({ kind: "ready", text })}
    />
  );
}
