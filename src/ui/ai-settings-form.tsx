import { Action, ActionPanel, Form, Icon, Keyboard } from "@raycast/api";
import { useState } from "react";

import {
  PROVIDER_DEFAULT_REASONING,
  REASONING_EFFORTS,
  resolveProviderAISettings,
  type AIOverride,
  type Model,
  type ProviderAISettings,
  type ReasoningEffort,
} from "../lib/ai-settings";

const INHERIT_MODEL = "promptkit:model:inherit";
const MANUAL_MODEL = "promptkit:model:manual";
const CATALOG_MODEL_PREFIX = "promptkit:model:catalog:";
const INHERIT_REASONING = "promptkit:reasoning:inherit";

const REASONING_LABELS: Record<ReasoningEffort, string> = {
  none: "None",
  minimal: "Minimal",
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
};

const REASONING_OPTIONS = REASONING_EFFORTS.map((value) => ({ value, title: REASONING_LABELS[value] }));

type CatalogModelDraft = { kind: "catalog"; id: string };
type ManualModelDraft = { kind: "manual"; value: string };
type ReasoningDraft = { kind: "provider-default" } | { kind: "effort"; value: ReasoningEffort };

export type GlobalAISettingsDraft = {
  scope: "global";
  model: CatalogModelDraft | ManualModelDraft;
  reasoning: ReasoningDraft;
};

export type TargetAISettingsDraft = {
  scope: "target";
  model: { kind: "inherit" } | CatalogModelDraft | ManualModelDraft;
  reasoning: { kind: "inherit" } | ReasoningDraft;
};

type AISettingsDraft = GlobalAISettingsDraft | TargetAISettingsDraft;

export type GlobalAISettingsValue = {
  model: string;
  reasoningEffort?: ReasoningEffort;
};

type SettingsFieldsProps = {
  models: Model[];
  value: AISettingsDraft;
  onChange: (value: AISettingsDraft) => void;
  modelError?: string;
  modelNotice?: string;
  globalSummary?: string;
};

type TargetAISettingsFormProps = {
  title: string;
  models: Model[];
  modelNotice?: string;
  isLoading?: boolean;
  onRefreshModels?: () => void | Promise<void>;
  initialValue: AIOverride;
  globalSummary: string;
  onSave: (value: AIOverride) => void | Promise<void>;
};

function createConfiguredModelDraft(model: string, models: Model[]): CatalogModelDraft | ManualModelDraft {
  return models.some((availableModel) => availableModel.id === model)
    ? { kind: "catalog", id: model }
    : { kind: "manual", value: model };
}

export function createGlobalAISettingsDraft(value: GlobalAISettingsValue, models: Model[]): GlobalAISettingsDraft {
  return {
    scope: "global",
    model: createConfiguredModelDraft(value.model, models),
    reasoning: value.reasoningEffort ? { kind: "effort", value: value.reasoningEffort } : { kind: "provider-default" },
  };
}

export function createTargetAISettingsDraft(value: AIOverride, models: Model[]): TargetAISettingsDraft {
  return {
    scope: "target",
    model: value.model ? createConfiguredModelDraft(value.model, models) : { kind: "inherit" },
    reasoning:
      value.reasoningEffort === undefined
        ? { kind: "inherit" }
        : value.reasoningEffort === PROVIDER_DEFAULT_REASONING
          ? { kind: "provider-default" }
          : { kind: "effort", value: value.reasoningEffort },
  };
}

function readModelDraft(value: AISettingsDraft["model"]): string | undefined {
  return value.kind === "inherit" ? undefined : value.kind === "manual" ? value.value.trim() : value.id;
}

function readReasoningDraft(value: AISettingsDraft["reasoning"]): AIOverride["reasoningEffort"] {
  return value.kind === "inherit"
    ? undefined
    : value.kind === "provider-default"
      ? PROVIDER_DEFAULT_REASONING
      : value.value;
}

export function readTargetAISettingsDraft(value: TargetAISettingsDraft): AIOverride | undefined {
  const model = readModelDraft(value.model);
  if (value.model.kind === "manual" && !model) {
    return undefined;
  }
  return {
    model,
    reasoningEffort: readReasoningDraft(value.reasoning),
  };
}

export function readGlobalAISettingsDraft(value: GlobalAISettingsDraft): GlobalAISettingsValue | undefined {
  const model = readModelDraft(value.model);
  if (!model) {
    return undefined;
  }
  return {
    model,
    reasoningEffort: value.reasoning.kind === "effort" ? value.reasoning.value : undefined,
  };
}

function modelSelection(value: AISettingsDraft["model"]): string {
  if (value.kind === "inherit") {
    return INHERIT_MODEL;
  }
  return value.kind === "manual" ? MANUAL_MODEL : `${CATALOG_MODEL_PREFIX}${encodeURIComponent(value.id)}`;
}

function updateModelSelection(value: AISettingsDraft, selection: string): AISettingsDraft {
  if (selection === INHERIT_MODEL && value.scope === "target") {
    return { ...value, model: { kind: "inherit" } };
  }
  if (selection === MANUAL_MODEL) {
    return { ...value, model: { kind: "manual", value: value.model.kind === "manual" ? value.model.value : "" } };
  }
  if (selection.startsWith(CATALOG_MODEL_PREFIX)) {
    return {
      ...value,
      model: { kind: "catalog", id: decodeURIComponent(selection.slice(CATALOG_MODEL_PREFIX.length)) },
    };
  }
  return value;
}

function reasoningSelection(value: AISettingsDraft["reasoning"]): string {
  return value.kind === "inherit"
    ? INHERIT_REASONING
    : value.kind === "provider-default"
      ? PROVIDER_DEFAULT_REASONING
      : value.value;
}

function updateReasoningSelection(value: AISettingsDraft, selection: string): AISettingsDraft {
  if (selection === INHERIT_REASONING && value.scope === "target") {
    return { ...value, reasoning: { kind: "inherit" } };
  }
  if (selection === PROVIDER_DEFAULT_REASONING) {
    return { ...value, reasoning: { kind: "provider-default" } };
  }
  const effort = REASONING_EFFORTS.find((candidate) => candidate === selection);
  return effort ? { ...value, reasoning: { kind: "effort", value: effort } } : value;
}

function reasoningLabel(reasoningEffort: ReturnType<typeof resolveProviderAISettings>["reasoningEffort"]): string {
  if (!reasoningEffort) {
    return "Provider default";
  }
  return REASONING_LABELS[reasoningEffort];
}

export function formatAISettingsSummary(settings: ProviderAISettings, targetId?: string): string {
  try {
    const resolved = resolveProviderAISettings(settings, targetId);
    return `${resolved.model} · ${reasoningLabel(resolved.reasoningEffort)}`;
  } catch {
    return "Not configured";
  }
}

function SettingsFields({ models, value, onChange, modelError, modelNotice, globalSummary }: SettingsFieldsProps) {
  return (
    <>
      <Form.Dropdown
        id="model"
        title="Model"
        value={modelSelection(value.model)}
        onChange={(selection) => onChange(updateModelSelection(value, selection))}
      >
        {value.scope === "target" ? <Form.Dropdown.Item value={INHERIT_MODEL} title="Use global default" /> : null}
        {models.map((model) => (
          <Form.Dropdown.Item
            key={model.id}
            value={`${CATALOG_MODEL_PREFIX}${encodeURIComponent(model.id)}`}
            title={model.id}
          />
        ))}
        <Form.Dropdown.Item value={MANUAL_MODEL} title="Enter manually" />
      </Form.Dropdown>
      {value.model.kind === "manual" ? (
        <Form.TextField
          id="manualModel"
          title="Model name"
          placeholder="gpt-5-mini"
          value={value.model.value}
          error={modelError}
          onChange={(manualModel) => onChange({ ...value, model: { kind: "manual", value: manualModel } })}
        />
      ) : null}
      {modelNotice ? <Form.Description title="Model list" text={modelNotice} /> : null}
      <Form.Dropdown
        id="reasoning"
        title="Reasoning"
        value={reasoningSelection(value.reasoning)}
        onChange={(selection) => onChange(updateReasoningSelection(value, selection))}
      >
        {value.scope === "target" ? <Form.Dropdown.Item value={INHERIT_REASONING} title="Use global default" /> : null}
        <Form.Dropdown.Item value={PROVIDER_DEFAULT_REASONING} title="Provider default" />
        {REASONING_OPTIONS.map((option) => (
          <Form.Dropdown.Item key={option.value} value={option.value} title={option.title} />
        ))}
      </Form.Dropdown>
      {value.scope === "target" && globalSummary ? (
        <Form.Description title="Global default" text={globalSummary} />
      ) : null}
      <Form.Description
        title="Reasoning support"
        text="Provider default omits reasoning_effort. Other levels require a compatible model and provider."
      />
    </>
  );
}

export function TargetAISettingsFields(
  props: Omit<SettingsFieldsProps, "value" | "onChange"> & {
    value: TargetAISettingsDraft;
    onChange: (value: TargetAISettingsDraft) => void;
  },
) {
  return (
    <SettingsFields
      {...props}
      onChange={(value) => {
        if (value.scope === "target") {
          props.onChange(value);
        }
      }}
    />
  );
}

export function GlobalAISettingsFields(
  props: Omit<SettingsFieldsProps, "value" | "onChange" | "globalSummary"> & {
    value: GlobalAISettingsDraft;
    onChange: (value: GlobalAISettingsDraft) => void;
  },
) {
  return (
    <SettingsFields
      {...props}
      onChange={(value) => {
        if (value.scope === "global") {
          props.onChange(value);
        }
      }}
    />
  );
}

export function TargetAISettingsForm(props: TargetAISettingsFormProps) {
  const [value, setValue] = useState<TargetAISettingsDraft>(() =>
    createTargetAISettingsDraft(props.initialValue, props.models),
  );
  const [modelError, setModelError] = useState<string>();

  const submit = async () => {
    const override = readTargetAISettingsDraft(value);
    if (!override) {
      setModelError("Enter the exact model name.");
      return;
    }
    await props.onSave(override);
  };

  return (
    <Form
      navigationTitle={props.title}
      isLoading={props.isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save settings" onSubmit={submit} />
          {props.onRefreshModels && !props.isLoading ? (
            <Action
              title="Refresh models"
              icon={Icon.ArrowClockwise}
              shortcut={Keyboard.Shortcut.Common.Refresh}
              onAction={props.onRefreshModels}
            />
          ) : null}
        </ActionPanel>
      }
    >
      <TargetAISettingsFields
        models={props.models}
        value={value}
        modelError={modelError}
        modelNotice={props.modelNotice}
        globalSummary={props.globalSummary}
        onChange={(nextValue: TargetAISettingsDraft) => {
          setValue(nextValue);
          setModelError(undefined);
        }}
      />
    </Form>
  );
}
