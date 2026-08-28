export type ExtensionErrorCode =
  | "missing-api-key"
  | "missing-model"
  | "invalid-base-url"
  | "invalid-source-limit"
  | "authentication"
  | "model-not-found"
  | "rate-limited"
  | "context-length"
  | "network"
  | "provider"
  | "cancelled"
  | "missing-input"
  | "selection-unavailable"
  | "clipboard-empty"
  | "browser-unavailable"
  | "browser-empty"
  | "prompt-too-long"
  | "task-not-found"
  | "task-invalid";

const ERROR_MESSAGES: Record<ExtensionErrorCode, string> = {
  "missing-api-key": "Add an API key in AI Settings. For a local provider, enter local.",
  "missing-model": "Choose a global default model in AI Settings.",
  "invalid-base-url": "Enter a valid HTTP or HTTPS Base URL in AI Settings.",
  "invalid-source-limit": "Set maximum source characters to an integer from 1,000 to 100,000.",
  authentication: "Authentication failed. Check your API key and try again.",
  "model-not-found": "The provider could not find that model. Check the global default or task override.",
  "rate-limited": "The provider is rate limiting requests. Wait a moment and try again.",
  "context-length": "This request is too large for the selected model. Lower the source limit and try again.",
  network: "Unable to reach the provider. Check the base URL and your connection, then try again.",
  provider: "The provider could not complete this request. Try again.",
  cancelled: "The request was cancelled.",
  "missing-input": "Enter some text to run this task.",
  "selection-unavailable": "Select some text and try again, or use {input} in this task.",
  "clipboard-empty": "Copy some text to the clipboard and try again.",
  "browser-unavailable": "Unable to read the current tab. Install or enable Raycast Browser Companion and try again.",
  "browser-empty": "The current tab does not contain readable text.",
  "prompt-too-long": "This task prompt is too large. Shorten the prompt or lower the source limit and try again.",
  "task-not-found": "This task no longer exists.",
  "task-invalid": "Add a title and prompt before saving this task.",
};

export class ExtensionError extends Error {
  constructor(
    public readonly code: ExtensionErrorCode,
    options?: ErrorOptions,
  ) {
    super(ERROR_MESSAGES[code], options);
    this.name = "ExtensionError";
  }
}

export function toExtensionError(error: unknown): ExtensionError {
  if (error instanceof ExtensionError) {
    return error;
  }
  if (error instanceof Error && error.name === "AbortError") {
    return new ExtensionError("cancelled", { cause: error });
  }
  return new ExtensionError("provider", error instanceof Error ? { cause: error } : undefined);
}
