import { Action, ActionPanel, Icon, Keyboard, List, useNavigation } from "@raycast/api";

import { AIConfigurationForm } from "./ui/ai-configuration-form";
import { formatAISettingsSummary } from "./ui/ai-settings-form";
import { useProviderAISettings } from "./ui/use-provider-ai-settings";

export default function AISettings() {
  const { data, error, isLoading, refreshModels, revalidate } = useProviderAISettings();
  const { pop, push } = useNavigation();

  const configure = () => {
    push(
      <AIConfigurationForm
        initialValue={data?.configuration}
        initialModels={data?.models ?? []}
        modelsUnavailable={data?.modelsUnavailable ?? false}
        onSaved={async () => {
          await revalidate();
          pop();
        }}
      />,
    );
  };

  if (error) {
    return (
      <List>
        <List.EmptyView
          icon={Icon.Warning}
          title="Unable to load AI settings"
          description="Try again."
          actions={
            <ActionPanel>
              <Action title="Retry" icon={Icon.ArrowClockwise} onAction={() => void revalidate()} />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  const configuration = data?.configuration;
  if (!isLoading && data && !configuration) {
    return (
      <List>
        <List.EmptyView
          icon={Icon.Gear}
          title="Set up your AI provider"
          description="Add a provider connection and choose the global default model."
          actions={
            <ActionPanel>
              <Action title="Set up AI" icon={Icon.Gear} onAction={configure} />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  const settings = data?.providerSettings;
  const editAction = <Action title="Edit AI settings" icon={Icon.Pencil} onAction={configure} />;
  const refreshAction = (
    <Action
      title="Refresh models"
      icon={Icon.ArrowClockwise}
      shortcut={Keyboard.Shortcut.Common.Refresh}
      onAction={() => void refreshModels()}
    />
  );

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search AI settings">
      {data?.modelsUnavailable ? (
        <List.Section title="Provider status">
          <List.Item
            icon={Icon.Warning}
            title="Model list unavailable"
            subtitle="Enter model names manually or refresh the list."
            actions={
              <ActionPanel>
                {refreshAction}
                {editAction}
              </ActionPanel>
            }
          />
        </List.Section>
      ) : null}
      {configuration ? (
        <List.Section title="Provider">
          <List.Item
            icon={Icon.Globe}
            title={new URL(configuration.baseURL).host}
            subtitle={configuration.baseURL}
            actions={
              <ActionPanel>
                {editAction}
                {refreshAction}
              </ActionPanel>
            }
          />
        </List.Section>
      ) : null}
      {settings && configuration ? (
        <List.Section title="Global defaults">
          <List.Item
            icon={Icon.Gear}
            title="Model and reasoning"
            subtitle={formatAISettingsSummary(settings)}
            accessories={[{ text: `${configuration.maximumSourceCharacters.toLocaleString()} chars` }]}
            actions={
              <ActionPanel>
                {editAction}
                {refreshAction}
              </ActionPanel>
            }
          />
        </List.Section>
      ) : null}
    </List>
  );
}
