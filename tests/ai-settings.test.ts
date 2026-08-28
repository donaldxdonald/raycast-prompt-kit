import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  copyTargetAIOverride,
  deleteTargetAIOverride,
  getAIConfiguration,
  getProviderAISettings,
  listAvailableModels,
  loadProviderAISettings,
  normalizeAIConfiguration,
  PROVIDER_DEFAULT_REASONING,
  refreshProviderModels,
  resolveAIConfiguration,
  saveAIConfiguration,
  setTargetAIOverride,
} from "../src/lib/ai-settings";
import { createMockServerPool } from "./helpers/mock-server";
import { __resetRaycast } from "./stubs/raycast-api";

const baseURL = "https://api.example.com/v1";
const servers = createMockServerPool();

const configuration = {
  apiKey: "fake-key",
  baseURL,
  defaultModel: "default-model",
  defaultReasoningEffort: "medium" as const,
  maximumSourceCharacters: 20_000,
};

beforeEach(() => {
  __resetRaycast();
});

afterEach(async () => {
  await servers.closeAll();
});

describe("AI configuration", () => {
  it("normalizes and persists the complete configuration", async () => {
    await expect(
      saveAIConfiguration({
        ...configuration,
        apiKey: "  fake-key  ",
        baseURL: "HTTPS://API.EXAMPLE.COM:443/v1/",
        defaultModel: "  default-model  ",
        maximumSourceCharacters: "20000",
      }),
    ).resolves.toEqual(configuration);

    await expect(getAIConfiguration()).resolves.toEqual(configuration);
  });

  it("validates the provider, model, and source limit", () => {
    expect(() => normalizeAIConfiguration({ ...configuration, apiKey: " " })).toThrowError(
      expect.objectContaining({ code: "missing-api-key" }),
    );
    expect(() => normalizeAIConfiguration({ ...configuration, defaultModel: " " })).toThrowError(
      expect.objectContaining({ code: "missing-model" }),
    );
    expect(() => normalizeAIConfiguration({ ...configuration, baseURL: "file:///tmp/provider" })).toThrowError(
      expect.objectContaining({ code: "invalid-base-url" }),
    );
    expect(() => normalizeAIConfiguration({ ...configuration, maximumSourceCharacters: "999" })).toThrowError(
      expect.objectContaining({ code: "invalid-source-limit" }),
    );
    expect(() => normalizeAIConfiguration({ ...configuration, maximumSourceCharacters: "100000.5" })).toThrowError(
      expect.objectContaining({ code: "invalid-source-limit" }),
    );
  });

  it("resolves the global defaults and a target override", async () => {
    await saveAIConfiguration(configuration);
    await setTargetAIOverride("built-in.ask-ai", { model: "reasoning-model", reasoningEffort: "high" });

    await expect(resolveAIConfiguration()).resolves.toEqual({
      apiKey: "fake-key",
      baseURL,
      model: "default-model",
      reasoningEffort: "medium",
      maximumSourceCharacters: 20_000,
    });
    await expect(resolveAIConfiguration("built-in.ask-ai")).resolves.toEqual({
      apiKey: "fake-key",
      baseURL,
      model: "reasoning-model",
      reasoningEffort: "high",
      maximumSourceCharacters: 20_000,
    });
  });

  it("can override global reasoning with the provider default", async () => {
    await saveAIConfiguration({ ...configuration, defaultReasoningEffort: "high" });
    await setTargetAIOverride("task-id", { reasoningEffort: PROVIDER_DEFAULT_REASONING });

    await expect(resolveAIConfiguration("task-id")).resolves.toMatchObject({
      model: "default-model",
      reasoningEffort: undefined,
    });
  });

  it("keeps concurrent overrides and removes empty overrides", async () => {
    await saveAIConfiguration(configuration);
    await Promise.all([
      setTargetAIOverride("first-task", { model: "first-model" }),
      setTargetAIOverride("second-task", { reasoningEffort: "high" }),
    ]);
    await setTargetAIOverride("second-task", {});

    await expect(getProviderAISettings()).resolves.toMatchObject({
      overrides: { "first-task": { model: "first-model" } },
    });
  });

  it("copies and deletes a target override", async () => {
    await saveAIConfiguration(configuration);
    await setTargetAIOverride("source-task", { model: "task-model", reasoningEffort: "high" });

    await copyTargetAIOverride("source-task", "duplicate-task");
    await expect(resolveAIConfiguration("duplicate-task")).resolves.toMatchObject({
      model: "task-model",
      reasoningEffort: "high",
    });

    await deleteTargetAIOverride("duplicate-task");
    await expect(resolveAIConfiguration("duplicate-task")).resolves.toMatchObject({
      model: "default-model",
      reasoningEffort: "medium",
    });
  });

  it("reports missing configuration through the request interface", async () => {
    await expect(resolveAIConfiguration()).rejects.toMatchObject({ code: "missing-api-key" });
  });
});

describe("provider models", () => {
  it("requests the provider models endpoint with bearer authentication", async () => {
    let receivedRequest: { path?: string; authorization?: string } = {};
    const { baseURL: serverBaseURL } = await servers.listen((request, response) => {
      receivedRequest = { path: request.url, authorization: request.headers.authorization };
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          object: "list",
          data: [
            { id: "model-b", object: "model", created: 2, owned_by: "provider" },
            { id: "model-a", object: "model", created: 1, owned_by: "provider" },
          ],
        }),
      );
    });

    const models = await listAvailableModels({
      apiKey: "fake-key",
      baseURL: serverBaseURL,
      abortSignal: new AbortController().signal,
    });

    expect(receivedRequest).toEqual({ path: "/v1/models", authorization: "Bearer fake-key" });
    expect(models.map((model) => model.id)).toEqual(["model-a", "model-b"]);
  });

  it("loads models once, then uses the encrypted local cache until refresh", async () => {
    let requestCount = 0;
    let modelId = "model-a";
    const { baseURL: serverBaseURL } = await servers.listen((_request, response) => {
      requestCount += 1;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          object: "list",
          data: [{ id: modelId, object: "model", created: 1, owned_by: "provider" }],
        }),
      );
    });
    await saveAIConfiguration({ ...configuration, baseURL: serverBaseURL });
    const signal = new AbortController().signal;

    const first = await loadProviderAISettings(signal);
    modelId = "model-b";
    const cached = await loadProviderAISettings(signal);

    expect(first.models).toEqual([{ id: "model-a" }]);
    expect(cached.models).toEqual([{ id: "model-a" }]);
    expect(requestCount).toBe(1);

    await refreshProviderModels({ apiKey: "fake-key", baseURL: serverBaseURL, abortSignal: signal });
    const refreshed = await loadProviderAISettings(signal);

    expect(refreshed.models).toEqual([{ id: "model-b" }]);
    expect(requestCount).toBe(2);
  });

  it("reuses models fetched while setting up the provider", async () => {
    let requestCount = 0;
    const { baseURL: serverBaseURL } = await servers.listen((_request, response) => {
      requestCount += 1;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          object: "list",
          data: [{ id: "setup-model", object: "model", created: 1, owned_by: "provider" }],
        }),
      );
    });
    const signal = new AbortController().signal;
    const models = await listAvailableModels({ apiKey: "fake-key", baseURL: serverBaseURL, abortSignal: signal });

    await saveAIConfiguration({ ...configuration, baseURL: serverBaseURL }, models);
    const loaded = await loadProviderAISettings(signal);

    expect(loaded.models).toEqual([{ id: "setup-model" }]);
    expect(requestCount).toBe(1);
  });

  it("does not request models before a provider is configured", async () => {
    await expect(loadProviderAISettings(new AbortController().signal)).resolves.toEqual({
      configuration: undefined,
      models: [],
      modelsUnavailable: false,
      providerSettings: { defaultModel: undefined, defaultReasoningEffort: undefined, overrides: {} },
    });
  });
});
