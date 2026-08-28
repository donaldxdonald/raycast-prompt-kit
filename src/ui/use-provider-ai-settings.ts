import { showToast, Toast } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { useRef } from "react";

import { loadProviderAISettings, refreshProviderModels } from "../lib/ai-settings";

export function useProviderAISettings() {
  const abortable = useRef<AbortController>(null);
  const result = usePromise(
    async () => loadProviderAISettings(abortable.current?.signal ?? new AbortController().signal),
    [],
    { abortable, onError: () => undefined },
  );

  const refreshModels = async () => {
    const configuration = result.data?.configuration;
    if (!configuration) {
      return;
    }
    const toast = await showToast({ style: Toast.Style.Animated, title: "Refreshing models" });
    try {
      await refreshProviderModels({
        apiKey: configuration.apiKey,
        baseURL: configuration.baseURL,
        abortSignal: abortable.current?.signal ?? new AbortController().signal,
      });
      await result.revalidate();
      toast.style = Toast.Style.Success;
      toast.title = "Model list updated";
    } catch {
      toast.style = Toast.Style.Failure;
      toast.title = "Unable to refresh models";
      toast.message = "Check the provider Base URL and API key, then try again.";
    }
  };

  return { refreshModels, ...result };
}
