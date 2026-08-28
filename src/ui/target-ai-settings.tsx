import { Action, ActionPanel, Detail, Icon, showToast, Toast, useNavigation } from "@raycast/api";
import { setTargetAIOverride } from "../lib/ai-settings";
import type { AITaskDefinition } from "../types";
import { formatAISettingsSummary, TargetAISettingsForm } from "./ai-settings-form";
import { useProviderAISettings } from "./use-provider-ai-settings";
import { OpenAISettingsAction } from "./open-ai-settings-action";

function SettingsError({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <Detail
      markdown={`# ${title}\n\n${message}`}
      actions={
        <ActionPanel>
          {onRetry ? <Action title="Retry" icon={Icon.ArrowClockwise} onAction={onRetry} /> : null}
          <OpenAISettingsAction />
        </ActionPanel>
      }
    />
  );
}

function TargetAISettings({ task }: { task: AITaskDefinition }) {
  const { data, error, isLoading, refreshModels, revalidate } = useProviderAISettings();
  const { pop } = useNavigation();

  if (isLoading && !data) {
    return <Detail isLoading markdown={`# ${task.title}\n\nLoading AI settings...`} />;
  }
  if (error || !data) {
    return <SettingsError title="Unable to load AI settings" message="Try again." onRetry={() => void revalidate()} />;
  }
  if (!data.configuration) {
    return <SettingsError title="AI provider not configured" message="Set up a provider before adding an override." />;
  }

  return (
    <TargetAISettingsForm
      title={`${task.title} AI settings`}
      models={data.models}
      initialValue={data.providerSettings.overrides[task.id] ?? {}}
      globalSummary={formatAISettingsSummary(data.providerSettings)}
      modelNotice={
        data.modelsUnavailable
          ? "The provider model list is unavailable. You can still enter a model name manually."
          : undefined
      }
      isLoading={isLoading}
      onRefreshModels={refreshModels}
      onSave={async (value) => {
        await setTargetAIOverride(task.id, value);
        await showToast({ style: Toast.Style.Success, title: "AI settings saved" });
        pop();
      }}
    />
  );
}

export function TargetAISettingsAction({ task }: { task: AITaskDefinition }) {
  const { push } = useNavigation();
  return <Action title="Edit AI settings" icon={Icon.Gear} onAction={() => push(<TargetAISettings task={task} />)} />;
}
