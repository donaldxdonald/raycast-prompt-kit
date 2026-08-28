import { Action, ActionPanel, Form, Icon, Keyboard, showToast, Toast } from "@raycast/api";
import { useEffect, useRef, useState } from "react";

import {
  DEFAULT_MAXIMUM_SOURCE_CHARACTERS,
  listAvailableModels,
  MAXIMUM_SOURCE_CHARACTERS,
  MINIMUM_SOURCE_CHARACTERS,
  saveAIConfiguration,
  type AIConfiguration,
  type Model,
} from "../lib/ai-settings";
import { toExtensionError } from "../lib/extension-error";
import {
  createGlobalAISettingsDraft,
  GlobalAISettingsFields,
  readGlobalAISettingsDraft,
  type GlobalAISettingsDraft,
} from "./ai-settings-form";

type AIConfigurationFormProps = {
  initialValue?: AIConfiguration;
  initialModels: Model[];
  modelsUnavailable: boolean;
  onSaved: () => void | Promise<void>;
};

type FieldErrors = Partial<Record<"apiKey" | "baseURL" | "model" | "maximumSourceCharacters", string>>;

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

export function AIConfigurationForm({
  initialValue,
  initialModels,
  modelsUnavailable,
  onSaved,
}: AIConfigurationFormProps) {
  const [apiKey, setAPIKey] = useState(initialValue?.apiKey ?? "");
  const [baseURL, setBaseURL] = useState(initialValue?.baseURL ?? DEFAULT_BASE_URL);
  const [maximumSourceCharacters, setMaximumSourceCharacters] = useState(
    String(initialValue?.maximumSourceCharacters ?? DEFAULT_MAXIMUM_SOURCE_CHARACTERS),
  );
  const [models, setModels] = useState(initialModels);
  const [hasFetchedModels, setHasFetchedModels] = useState(false);
  const [modelNotice, setModelNotice] = useState(
    modelsUnavailable ? "The provider model list is unavailable. Enter a model name manually or try again." : undefined,
  );
  const [settings, setSettings] = useState<GlobalAISettingsDraft>(() =>
    createGlobalAISettingsDraft(
      {
        model: initialValue?.defaultModel ?? "",
        reasoningEffort: initialValue?.defaultReasoningEffort,
      },
      initialModels,
    ),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const abortController = useRef<AbortController>(null);

  useEffect(() => () => abortController.current?.abort(), []);

  const clearConnectionModels = () => {
    setModels([]);
    setHasFetchedModels(false);
    setModelNotice("Fetch models after changing the provider connection.");
    setSettings((current) => {
      const value = readGlobalAISettingsDraft(current);
      return value ? createGlobalAISettingsDraft(value, []) : current;
    });
  };

  const fetchModels = async () => {
    abortController.current?.abort();
    const controller = new AbortController();
    abortController.current = controller;
    setIsLoading(true);
    const toast = await showToast({ style: Toast.Style.Animated, title: "Fetching models" });
    try {
      const fetchedModels = await listAvailableModels({ apiKey, baseURL, abortSignal: controller.signal });
      setModels(fetchedModels);
      setHasFetchedModels(true);
      setModelNotice(undefined);
      setErrors((current) => ({ ...current, apiKey: undefined, baseURL: undefined }));
      toast.style = Toast.Style.Success;
      toast.title = "Model list updated";
    } catch (error) {
      const extensionError = toExtensionError(error);
      if (extensionError.code === "missing-api-key") {
        setErrors((current) => ({ ...current, apiKey: extensionError.message }));
      } else if (extensionError.code === "invalid-base-url") {
        setErrors((current) => ({ ...current, baseURL: extensionError.message }));
      }
      setModelNotice("Unable to fetch models. You can still enter a model name manually.");
      toast.style = Toast.Style.Failure;
      toast.title = "Unable to fetch models";
      toast.message = extensionError.message;
    } finally {
      setIsLoading(false);
    }
  };

  const submit = async () => {
    const globalSettings = readGlobalAISettingsDraft(settings);
    if (!globalSettings) {
      setErrors((current) => ({ ...current, model: "Choose a model or enter its exact name." }));
      return;
    }
    setIsLoading(true);
    try {
      await saveAIConfiguration(
        {
          apiKey,
          baseURL,
          defaultModel: globalSettings.model,
          defaultReasoningEffort: globalSettings.reasoningEffort,
          maximumSourceCharacters,
        },
        hasFetchedModels ? models : undefined,
      );
      await showToast({ style: Toast.Style.Success, title: "AI settings saved" });
      await onSaved();
    } catch (error) {
      const extensionError = toExtensionError(error);
      const field =
        extensionError.code === "missing-api-key"
          ? "apiKey"
          : extensionError.code === "invalid-base-url"
            ? "baseURL"
            : extensionError.code === "invalid-source-limit"
              ? "maximumSourceCharacters"
              : extensionError.code === "missing-model"
                ? "model"
                : undefined;
      if (field) {
        setErrors((current) => ({ ...current, [field]: extensionError.message }));
      } else {
        await showToast({ style: Toast.Style.Failure, title: "Unable to save AI settings" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form
      navigationTitle={initialValue ? "Edit AI settings" : "Set up AI"}
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save AI settings" onSubmit={submit} />
          {!isLoading ? (
            <Action
              title="Fetch models"
              icon={Icon.ArrowClockwise}
              shortcut={Keyboard.Shortcut.Common.Refresh}
              onAction={fetchModels}
            />
          ) : null}
        </ActionPanel>
      }
    >
      <Form.PasswordField
        id="apiKey"
        title="API key"
        placeholder="sk-..."
        value={apiKey}
        error={errors.apiKey}
        onChange={(value) => {
          setAPIKey(value);
          setErrors((current) => ({ ...current, apiKey: undefined }));
          clearConnectionModels();
        }}
      />
      <Form.TextField
        id="baseURL"
        title="Base URL"
        placeholder={DEFAULT_BASE_URL}
        value={baseURL}
        error={errors.baseURL}
        onChange={(value) => {
          setBaseURL(value);
          setErrors((current) => ({ ...current, baseURL: undefined }));
          clearConnectionModels();
        }}
      />
      <Form.Description
        title="Local providers"
        text="If your provider ignores authentication, enter local as the API key."
      />
      <Form.Separator />
      <GlobalAISettingsFields
        models={models}
        value={settings}
        modelError={errors.model}
        modelNotice={modelNotice}
        onChange={(value) => {
          setSettings(value);
          setErrors((current) => ({ ...current, model: undefined }));
        }}
      />
      <Form.Separator />
      <Form.TextField
        id="maximumSourceCharacters"
        title="Maximum source characters"
        value={maximumSourceCharacters}
        error={errors.maximumSourceCharacters}
        onChange={(value) => {
          setMaximumSourceCharacters(value);
          setErrors((current) => ({ ...current, maximumSourceCharacters: undefined }));
        }}
      />
      <Form.Description
        title="Source limit"
        text={`Enter an integer from ${MINIMUM_SOURCE_CHARACTERS.toLocaleString()} to ${MAXIMUM_SOURCE_CHARACTERS.toLocaleString()}.`}
      />
    </Form>
  );
}
