import { getSelectedText } from "@raycast/api";

export type TextInputResolution = { kind: "ready"; text: string } | { kind: "form" };

export async function resolveTextInput(
  argument: string | undefined,
  readSelection: () => Promise<string> = getSelectedText,
): Promise<TextInputResolution> {
  const argumentText = argument?.trim();
  if (argumentText) {
    return { kind: "ready", text: argumentText };
  }

  try {
    const selectedText = (await readSelection()).trim();
    return selectedText ? { kind: "ready", text: selectedText } : { kind: "form" };
  } catch {
    return { kind: "form" };
  }
}
