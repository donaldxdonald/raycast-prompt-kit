import { Action, ActionPanel, Form, Icon, Keyboard } from "@raycast/api";
import { useForm } from "@raycast/utils";
import { useState } from "react";

import { type AIOverride, type Model } from "../lib/ai-settings";
import { TASK_ICON_OPTIONS } from "../lib/task-icons";
import { saveTask } from "../lib/task-store";
import { DEFAULT_TASK_ICON, isTaskIcon, type AITask, type TaskInput } from "../types";
import {
  createTargetAISettingsDraft,
  formatAISettingsSummary,
  readTargetAISettingsDraft,
  TargetAISettingsFields,
  type TargetAISettingsDraft,
} from "./ai-settings-form";
import { useProviderAISettings } from "./use-provider-ai-settings";
import { OpenAISettingsAction } from "./open-ai-settings-action";

type TaskFormValues = {
  title: string;
  description: string;
  prompt: string;
  icon: string;
};

type TaskFormProps = {
  task?: AITask;
  onSaved: (task: AITask) => void | Promise<void>;
};

type LoadedAISettings = {
  models: Model[];
  modelsUnavailable: boolean;
  override: AIOverride;
  globalSummary: string;
};

const PLACEHOLDERS = ["{input}", "{selection}", "{clipboard}", "{browser-tab}"] as const;

type LoadedTaskFormProps = TaskFormProps & {
  aiSettings?: LoadedAISettings;
  aiSettingsError?: string;
  aiSettingsLoading: boolean;
  onRefreshModels?: () => void | Promise<void>;
};

function LoadedTaskForm({
  task,
  onSaved,
  aiSettings,
  aiSettingsError,
  aiSettingsLoading,
  onRefreshModels,
}: LoadedTaskFormProps) {
  const [editedAISettings, setEditedAISettings] = useState<TargetAISettingsDraft>();
  const aiSettingsDraft =
    editedAISettings ?? createTargetAISettingsDraft(aiSettings?.override ?? {}, aiSettings?.models ?? []);
  const [modelError, setModelError] = useState<string>();
  const { handleSubmit, itemProps, setValue } = useForm<TaskFormValues>({
    initialValues: {
      title: task?.title ?? "",
      description: task?.description ?? "",
      prompt: task?.prompt ?? "",
      icon: task?.icon ?? DEFAULT_TASK_ICON,
    },
    async onSubmit(values) {
      const aiOverride = aiSettings ? readTargetAISettingsDraft(aiSettingsDraft) : undefined;
      if (aiSettings && !aiOverride) {
        setModelError("Enter the exact model name.");
        return;
      }
      const taskInput: TaskInput = {
        title: values.title,
        description: values.description || undefined,
        prompt: values.prompt,
        icon: isTaskIcon(values.icon) ? values.icon : DEFAULT_TASK_ICON,
      };
      const savedTask = await saveTask(
        task?.id,
        taskInput,
        aiSettings && aiOverride ? { override: aiOverride } : undefined,
      );
      await onSaved(savedTask);
    },
    validation: {
      title: (value) => (value?.trim() ? undefined : "Enter a task title."),
      prompt: (value) => (value?.trim() ? undefined : "Enter a prompt."),
    },
  });

  const insertPlaceholder = (placeholder: (typeof PLACEHOLDERS)[number]) => {
    setValue("prompt", (current) => `${current}${current.trim() ? "\n\n" : ""}${placeholder}`);
  };

  return (
    <Form
      navigationTitle={task ? "Edit task" : "Create task"}
      isLoading={aiSettingsLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title={task ? "Save task" : "Create task"} onSubmit={handleSubmit} />
          <ActionPanel.Submenu title="Insert placeholder" icon={Icon.Plus}>
            {PLACEHOLDERS.map((placeholder) => (
              <Action
                key={placeholder}
                title={`Insert ${placeholder}`}
                onAction={() => insertPlaceholder(placeholder)}
              />
            ))}
          </ActionPanel.Submenu>
          {onRefreshModels ? (
            <Action
              title="Refresh models"
              icon={Icon.ArrowClockwise}
              shortcut={Keyboard.Shortcut.Common.Refresh}
              onAction={onRefreshModels}
            />
          ) : null}
          {aiSettingsError ? <OpenAISettingsAction /> : null}
        </ActionPanel>
      }
    >
      <Form.TextField title="Title" placeholder="Weekly summary" {...itemProps.title} />
      <Form.Dropdown title="Icon" {...itemProps.icon}>
        {TASK_ICON_OPTIONS.map((option) => (
          <Form.Dropdown.Item key={option.value} {...option} />
        ))}
      </Form.Dropdown>
      <Form.TextField title="Description" placeholder="What this task does" {...itemProps.description} />
      <Form.TextArea title="Prompt" placeholder="Summarize the following text..." {...itemProps.prompt} />
      <Form.Description
        title="Placeholders"
        text="Use {input}, {selection}, {clipboard}, or {browser-tab}. PromptKit reads only the sources used by this task."
      />
      <Form.Separator />
      {aiSettings ? (
        <TargetAISettingsFields
          models={aiSettings.models}
          value={aiSettingsDraft}
          modelError={modelError}
          modelNotice={
            aiSettings.modelsUnavailable
              ? "The provider model list is unavailable. You can still enter a model name manually."
              : undefined
          }
          globalSummary={aiSettings.globalSummary}
          onChange={(value) => {
            setEditedAISettings(value);
            setModelError(undefined);
          }}
        />
      ) : aiSettingsLoading ? (
        <Form.Description title="AI settings" text="Loading models and defaults..." />
      ) : (
        <Form.Description
          title="AI settings unavailable"
          text={aiSettingsError ?? "Configure the provider before choosing a model for this task."}
        />
      )}
    </Form>
  );
}

export function TaskForm(props: TaskFormProps) {
  const { data, error, isLoading, refreshModels } = useProviderAISettings();

  const aiSettings: LoadedAISettings | undefined = data?.configuration
    ? {
        models: data.models,
        modelsUnavailable: data.modelsUnavailable,
        override: props.task ? (data.providerSettings.overrides[props.task.id] ?? {}) : {},
        globalSummary: formatAISettingsSummary(data.providerSettings),
      }
    : undefined;

  return (
    <LoadedTaskForm
      {...props}
      aiSettings={aiSettings}
      aiSettingsError={
        error
          ? "PromptKit could not load AI settings."
          : data && !data.configuration
            ? "Set up an AI provider before choosing a model for this task."
            : undefined
      }
      aiSettingsLoading={isLoading}
      onRefreshModels={data?.configuration && !isLoading ? refreshModels : undefined}
    />
  );
}
