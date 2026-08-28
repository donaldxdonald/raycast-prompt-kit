import { LocalStorage } from "@raycast/api";
import { listModels, type Model as ProviderModel } from "@xsai/model";

import { ExtensionError } from "./extension-error";

const CONFIGURATION_STORAGE_KEY = "aiConfiguration.v1";
const OVERRIDE_STORAGE_PREFIX = "aiOverride.v1::";
const MODEL_CACHE_STORAGE_KEY = "providerModels.v1";

export const PROVIDER_DEFAULT_REASONING = "provider-default" as const;
export const REASONING_EFFORTS = ["none", "minimal", "medium", "high", "xhigh"] as const;
export const DEFAULT_MAXIMUM_SOURCE_CHARACTERS = 20_000;
export const MINIMUM_SOURCE_CHARACTERS = 1_000;
export const MAXIMUM_SOURCE_CHARACTERS = 100_000;

export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export type AIOverride = {
  model?: string;
  reasoningEffort?: ReasoningEffort | typeof PROVIDER_DEFAULT_REASONING;
};

export type AIConfiguration = {
  apiKey: string;
  baseURL: string;
  defaultModel: string;
  defaultReasoningEffort?: ReasoningEffort;
  maximumSourceCharacters: number;
};

export type AIConfigurationInput = Omit<AIConfiguration, "maximumSourceCharacters"> & {
  maximumSourceCharacters: number | string;
};

export type ProviderAISettings = {
  defaultModel?: string;
  defaultReasoningEffort?: ReasoningEffort;
  overrides: Record<string, AIOverride>;
};

export type ResolvedAISettings = {
  model: string;
  reasoningEffort?: ReasoningEffort;
};

export type ResolvedAIConfiguration = Pick<AIConfiguration, "apiKey" | "baseURL" | "maximumSourceCharacters"> &
  ResolvedAISettings;

export type Model = Pick<ProviderModel, "id">;

type ProviderConnection = Pick<AIConfiguration, "apiKey" | "baseURL">;
type StoredProviderModels = { baseURL: string; modelIds: string[] };

function parseStoredJSON(value: LocalStorage.Value | undefined): unknown {
  if (typeof value !== "string") {
    return undefined;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function isReasoningEffort(value: unknown): value is ReasoningEffort {
  return typeof value === "string" && REASONING_EFFORTS.some((effort) => effort === value);
}

export function normalizeProviderBaseURL(baseURL: string): string {
  let url: URL;
  try {
    url = new URL(baseURL.trim());
  } catch {
    throw new ExtensionError("invalid-base-url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ExtensionError("invalid-base-url");
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function normalizeProviderConnection(input: ProviderConnection): ProviderConnection {
  const apiKey = input.apiKey.trim();
  if (!apiKey) {
    throw new ExtensionError("missing-api-key");
  }
  return { apiKey, baseURL: normalizeProviderBaseURL(input.baseURL) };
}

export function normalizeAIConfiguration(input: AIConfigurationInput): AIConfiguration {
  const connection = normalizeProviderConnection(input);
  const defaultModel = input.defaultModel.trim();
  if (!defaultModel) {
    throw new ExtensionError("missing-model");
  }
  const maximumSourceCharacters = Number(input.maximumSourceCharacters);
  if (
    !Number.isInteger(maximumSourceCharacters) ||
    maximumSourceCharacters < MINIMUM_SOURCE_CHARACTERS ||
    maximumSourceCharacters > MAXIMUM_SOURCE_CHARACTERS
  ) {
    throw new ExtensionError("invalid-source-limit");
  }
  return {
    ...connection,
    defaultModel,
    defaultReasoningEffort: input.defaultReasoningEffort,
    maximumSourceCharacters,
  };
}

function readAIConfiguration(value: unknown): AIConfiguration | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.apiKey !== "string" ||
    typeof candidate.baseURL !== "string" ||
    typeof candidate.defaultModel !== "string" ||
    (candidate.defaultReasoningEffort !== undefined && !isReasoningEffort(candidate.defaultReasoningEffort)) ||
    (typeof candidate.maximumSourceCharacters !== "number" && typeof candidate.maximumSourceCharacters !== "string")
  ) {
    return undefined;
  }
  try {
    return normalizeAIConfiguration({
      apiKey: candidate.apiKey,
      baseURL: candidate.baseURL,
      defaultModel: candidate.defaultModel,
      defaultReasoningEffort: candidate.defaultReasoningEffort,
      maximumSourceCharacters: candidate.maximumSourceCharacters,
    });
  } catch {
    return undefined;
  }
}

function readOverride(value: unknown): AIOverride | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  const model = typeof candidate.model === "string" ? candidate.model.trim() || undefined : undefined;
  const reasoningEffort =
    candidate.reasoningEffort === PROVIDER_DEFAULT_REASONING || isReasoningEffort(candidate.reasoningEffort)
      ? candidate.reasoningEffort
      : undefined;
  return model || reasoningEffort ? { model, reasoningEffort } : undefined;
}

function readCachedProviderModels(value: unknown): StoredProviderModels | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.baseURL !== "string" ||
    !Array.isArray(candidate.modelIds) ||
    !candidate.modelIds.every((modelId) => typeof modelId === "string")
  ) {
    return undefined;
  }
  const modelIds = [...new Set(candidate.modelIds.map((modelId) => modelId.trim()).filter(Boolean))].toSorted();
  return { baseURL: candidate.baseURL, modelIds };
}

function targetOverrideKey(targetId: string): string {
  return `${OVERRIDE_STORAGE_PREFIX}${encodeURIComponent(targetId)}`;
}

export async function getAIConfiguration(): Promise<AIConfiguration | undefined> {
  const stored = await LocalStorage.getItem<string>(CONFIGURATION_STORAGE_KEY);
  return readAIConfiguration(parseStoredJSON(stored));
}

export async function saveAIConfiguration(
  input: AIConfigurationInput,
  prefetchedModels?: Model[],
): Promise<AIConfiguration> {
  const configuration = normalizeAIConfiguration(input);
  const previous = await getAIConfiguration();
  if (previous && (previous.apiKey !== configuration.apiKey || previous.baseURL !== configuration.baseURL)) {
    await LocalStorage.removeItem(MODEL_CACHE_STORAGE_KEY);
  }
  await LocalStorage.setItem(CONFIGURATION_STORAGE_KEY, JSON.stringify(configuration));
  if (prefetchedModels) {
    await setCachedProviderModels(configuration.baseURL, prefetchedModels);
  }
  return configuration;
}

async function readTargetOverride(targetId: string): Promise<AIOverride | undefined> {
  const stored = await LocalStorage.getItem<string>(targetOverrideKey(targetId));
  return readOverride(parseStoredJSON(stored));
}

async function readAllTargetOverrides(): Promise<Record<string, AIOverride>> {
  const items = await LocalStorage.allItems();
  return Object.fromEntries(
    Object.entries(items).flatMap(([key, stored]) => {
      if (!key.startsWith(OVERRIDE_STORAGE_PREFIX)) {
        return [];
      }
      const override = readOverride(parseStoredJSON(stored));
      return override ? [[decodeURIComponent(key.slice(OVERRIDE_STORAGE_PREFIX.length)), override]] : [];
    }),
  );
}

export async function getProviderAISettings(): Promise<ProviderAISettings> {
  const [configuration, overrides] = await Promise.all([getAIConfiguration(), readAllTargetOverrides()]);
  return createProviderAISettings(configuration, overrides);
}

function createProviderAISettings(
  configuration: AIConfiguration | undefined,
  overrides: Record<string, AIOverride>,
): ProviderAISettings {
  return {
    defaultModel: configuration?.defaultModel,
    defaultReasoningEffort: configuration?.defaultReasoningEffort,
    overrides,
  };
}

export function resolveProviderAISettings(settings: ProviderAISettings, targetId?: string): ResolvedAISettings {
  const override = targetId ? settings.overrides[targetId] : undefined;
  const model = override?.model?.trim() || settings.defaultModel?.trim();
  if (!model) {
    throw new ExtensionError("missing-model");
  }
  const reasoningEffort =
    override?.reasoningEffort === PROVIDER_DEFAULT_REASONING
      ? undefined
      : (override?.reasoningEffort ?? settings.defaultReasoningEffort);
  return { model, reasoningEffort };
}

export async function resolveAIConfiguration(targetId?: string): Promise<ResolvedAIConfiguration> {
  const [configuration, override] = await Promise.all([
    getAIConfiguration(),
    targetId ? readTargetOverride(targetId) : Promise.resolve(undefined),
  ]);
  if (!configuration) {
    throw new ExtensionError("missing-api-key");
  }
  const resolved = resolveProviderAISettings(
    {
      defaultModel: configuration.defaultModel,
      defaultReasoningEffort: configuration.defaultReasoningEffort,
      overrides: targetId && override ? { [targetId]: override } : {},
    },
    targetId,
  );
  return {
    apiKey: configuration.apiKey,
    baseURL: configuration.baseURL,
    maximumSourceCharacters: configuration.maximumSourceCharacters,
    ...resolved,
  };
}

export async function setTargetAIOverride(targetId: string, override: AIOverride): Promise<void> {
  const key = targetOverrideKey(targetId);
  const normalized = readOverride(override);
  if (normalized) {
    await LocalStorage.setItem(key, JSON.stringify(normalized));
  } else {
    await LocalStorage.removeItem(key);
  }
}

export async function copyTargetAIOverride(sourceTargetId: string, destinationTargetId: string): Promise<void> {
  const override = await readTargetOverride(sourceTargetId);
  if (override) {
    await setTargetAIOverride(destinationTargetId, override);
  }
}

export async function deleteTargetAIOverride(targetId: string): Promise<void> {
  await LocalStorage.removeItem(targetOverrideKey(targetId));
}

export type ListAvailableModelsInput = ProviderConnection & { abortSignal: AbortSignal };

export async function listAvailableModels(input: ListAvailableModelsInput): Promise<Model[]> {
  const connection = normalizeProviderConnection(input);
  const models = await listModels({ ...connection, abortSignal: input.abortSignal });
  return models.map(({ id }) => ({ id })).toSorted((left, right) => left.id.localeCompare(right.id));
}

async function getCachedProviderModels(baseURL: string): Promise<Model[] | undefined> {
  const stored = await LocalStorage.getItem<string>(MODEL_CACHE_STORAGE_KEY);
  const cached = readCachedProviderModels(parseStoredJSON(stored));
  return cached?.baseURL === baseURL ? cached.modelIds.map((id) => ({ id })) : undefined;
}

async function setCachedProviderModels(baseURL: string, models: Model[]): Promise<void> {
  await LocalStorage.setItem(
    MODEL_CACHE_STORAGE_KEY,
    JSON.stringify({ baseURL, modelIds: models.map((model) => model.id) } satisfies StoredProviderModels),
  );
}

export type LoadedProviderAISettings = {
  configuration?: AIConfiguration;
  models: Model[];
  modelsUnavailable: boolean;
  providerSettings: ProviderAISettings;
};

export async function refreshProviderModels(input: ListAvailableModelsInput): Promise<Model[]> {
  const connection = normalizeProviderConnection(input);
  const models = await listAvailableModels({ ...connection, abortSignal: input.abortSignal });
  await setCachedProviderModels(connection.baseURL, models);
  return models;
}

export async function loadProviderAISettings(abortSignal: AbortSignal): Promise<LoadedProviderAISettings> {
  const [configuration, overrides] = await Promise.all([getAIConfiguration(), readAllTargetOverrides()]);
  const providerSettings = createProviderAISettings(configuration, overrides);
  if (!configuration) {
    return { configuration, models: [], modelsUnavailable: false, providerSettings };
  }
  const cachedModels = await getCachedProviderModels(configuration.baseURL);
  if (cachedModels) {
    return { configuration, models: cachedModels, modelsUnavailable: false, providerSettings };
  }
  try {
    const models = await refreshProviderModels({ ...configuration, abortSignal });
    return { configuration, models, modelsUnavailable: false, providerSettings };
  } catch (error) {
    if (abortSignal.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw error;
    }
    return { configuration, models: [], modelsUnavailable: true, providerSettings };
  }
}
