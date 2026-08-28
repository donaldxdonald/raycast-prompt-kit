import { BrowserExtension, environment } from "@raycast/api";

import { ExtensionError } from "./extension-error";

type BrowserContentAPI = {
  canAccess(): boolean;
  getContent(options: { format: "markdown" }): Promise<string>;
};

const raycastBrowserAPI: BrowserContentAPI = {
  canAccess: () => environment.canAccess(BrowserExtension),
  getContent: (options) => BrowserExtension.getContent(options),
};

export async function readBrowserContent(
  signal: AbortSignal,
  browser: BrowserContentAPI = raycastBrowserAPI,
): Promise<string> {
  if (signal.aborted) {
    throw new ExtensionError("cancelled");
  }
  if (!browser.canAccess()) {
    throw new ExtensionError("browser-unavailable");
  }

  let content: string;
  try {
    content = await browser.getContent({ format: "markdown" });
  } catch (error) {
    if (signal.aborted) {
      throw new ExtensionError("cancelled", error instanceof Error ? { cause: error } : undefined);
    }
    throw new ExtensionError("browser-unavailable", error instanceof Error ? { cause: error } : undefined);
  }

  if (signal.aborted) {
    throw new ExtensionError("cancelled");
  }
  const text = content.trim();
  if (!text) {
    throw new ExtensionError("browser-empty");
  }
  return text;
}
