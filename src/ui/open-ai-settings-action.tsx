import { Action, Icon, launchCommand, LaunchType } from "@raycast/api";

export function OpenAISettingsAction() {
  return (
    <Action
      title="Open AI settings"
      icon={Icon.Gear}
      onAction={() => launchCommand({ name: "select-model", type: LaunchType.UserInitiated })}
    />
  );
}
