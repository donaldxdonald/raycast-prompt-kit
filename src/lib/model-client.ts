import { APICallError } from "@xsai/shared";
import { streamText } from "@xsai/stream-text";
import type { Message as ChatCompletionMessageParam } from "@xsai/stream-text/shared-chat";

import { resolveAIConfiguration, type ResolvedAIConfiguration } from "./ai-settings";
import { ExtensionError } from "./extension-error";

export type ModelConfig = ResolvedAIConfiguration;

export type StreamModelInput = {
  config?: ModelConfig;
  messages: ChatCompletionMessageParam[];
  signal: AbortSignal;
  onDelta: (delta: string) => void;
};

type ResolveModelConfigOptions = {
  targetId?: string;
};

export async function resolveModelConfig(options: ResolveModelConfigOptions = {}): Promise<ModelConfig> {
  return resolveAIConfiguration(options.targetId);
}

function mapModelError(error: unknown, signal: AbortSignal): ExtensionError {
  if (signal.aborted || (error instanceof Error && error.name === "AbortError")) {
    return new ExtensionError("cancelled", error instanceof Error ? { cause: error } : undefined);
  }

  if (APICallError.isInstance(error)) {
    const responseBody = error.responseBody?.toLowerCase() ?? "";
    const message = error.message.toLowerCase();
    if (error.statusCode === 401 || error.statusCode === 403) {
      return new ExtensionError("authentication", { cause: error });
    }
    if (error.statusCode === 404) {
      return new ExtensionError("model-not-found", { cause: error });
    }
    if (error.statusCode === 429) {
      return new ExtensionError("rate-limited", { cause: error });
    }
    if (responseBody.includes("context") || message.includes("context length") || message.includes("too many tokens")) {
      return new ExtensionError("context-length", { cause: error });
    }
  }

  if (error instanceof TypeError) {
    return new ExtensionError("network", { cause: error });
  }

  return new ExtensionError("provider", error instanceof Error ? { cause: error } : undefined);
}

export async function streamModelResponse({ config, messages, signal, onDelta }: StreamModelInput): Promise<string> {
  try {
    const resolvedConfig = config ?? (await resolveModelConfig());
    const result = streamText({
      abortSignal: signal,
      apiKey: resolvedConfig.apiKey,
      baseURL: resolvedConfig.baseURL,
      messages,
      model: resolvedConfig.model,
      reasoningEffort: resolvedConfig.reasoningEffort,
    });

    // xsAI rejects these metadata promises when the text stream fails. Observe
    // them here because PromptKit only consumes textStream.
    void Promise.allSettled([result.messages, result.steps, result.totalUsage, result.usage]);

    let text = "";
    for await (const delta of result.textStream) {
      text += delta;
      onDelta(delta);
    }
    return text;
  } catch (error) {
    throw mapModelError(error, signal);
  }
}

export type { ChatCompletionMessageParam };
