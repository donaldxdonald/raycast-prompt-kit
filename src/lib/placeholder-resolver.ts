import { ExtensionError } from "./extension-error";
import type { PlaceholderName, PlaceholderSources, ResolvedPrompt, ResolvedPromptPart } from "../types";

const PLACEHOLDER_PATTERN = /\{(input|selection|clipboard|browser-tab)\}/g;
const SHORTENED_MARKER = "\n…\n";

type ResolverOptions = {
  maximumSourceCharacters?: number;
  maximumPromptCharacters?: number;
};

const EMPTY_SOURCE_ERRORS: Record<
  PlaceholderName,
  "missing-input" | "selection-unavailable" | "clipboard-empty" | "browser-empty"
> = {
  input: "missing-input",
  selection: "selection-unavailable",
  clipboard: "clipboard-empty",
  "browser-tab": "browser-empty",
};

function shorten(text: string, maximumCharacters: number): { text: string; truncated: boolean } {
  if (text.length <= maximumCharacters) {
    return { text, truncated: false };
  }

  if (maximumCharacters <= SHORTENED_MARKER.length) {
    return { text: text.slice(0, maximumCharacters), truncated: true };
  }

  const available = maximumCharacters - SHORTENED_MARKER.length;
  const startLength = Math.ceil(available / 2);
  const endLength = Math.floor(available / 2);
  return {
    text: `${text.slice(0, startLength)}${SHORTENED_MARKER}${text.slice(text.length - endLength)}`,
    truncated: true,
  };
}

function requireText(source: PlaceholderName, value: string | undefined): string {
  const text = value?.trim();
  if (!text) {
    throw new ExtensionError(EMPTY_SOURCE_ERRORS[source]);
  }
  return text;
}

export function createPlaceholderResolver(
  sources: PlaceholderSources,
  options: ResolverOptions = {},
): {
  resolve(template: string, context: { input?: string; signal: AbortSignal }): Promise<ResolvedPrompt>;
} {
  const maximumSourceCharacters = options.maximumSourceCharacters ?? 20_000;
  const maximumPromptCharacters = options.maximumPromptCharacters ?? 100_000;

  return {
    async resolve(template, context) {
      const sourceCache = new Map<PlaceholderName, Promise<string>>();
      const truncatedSources = new Set<PlaceholderName>();

      const readSource = (source: PlaceholderName): Promise<string> => {
        const cached = sourceCache.get(source);
        if (cached) {
          return cached;
        }

        const value = (() => {
          switch (source) {
            case "input":
              return Promise.resolve(requireText(source, context.input));
            case "selection":
              return sources.getSelection(context.signal).then((text) => requireText(source, text));
            case "clipboard":
              return sources.getClipboard(context.signal).then((text) => requireText(source, text));
            case "browser-tab":
              return sources.getBrowserTab(context.signal).then((text) => requireText(source, text));
          }
        })();

        sourceCache.set(source, value);
        return value;
      };

      const matches = [...template.matchAll(PLACEHOLDER_PATTERN)];
      if (matches.length === 0) {
        if (template.length > maximumPromptCharacters) {
          throw new ExtensionError("prompt-too-long");
        }
        return { parts: template ? [{ kind: "instruction", text: template }] : [], truncatedSources: [] };
      }

      const sourceNames = new Set(matches.map((match) => match[1] as PlaceholderName));
      await Promise.all([...sourceNames].map((source) => readSource(source)));

      const parts: ResolvedPromptPart[] = [];
      let cursor = 0;
      for (const match of matches) {
        const index = match.index ?? 0;
        if (index > cursor) {
          parts.push({ kind: "instruction", text: template.slice(cursor, index) });
        }

        const source = match[1] as PlaceholderName;
        const shortened = shorten(await readSource(source), maximumSourceCharacters);
        if (shortened.truncated) {
          truncatedSources.add(source);
        }
        parts.push({ kind: "source", source, ...shortened });
        cursor = index + match[0].length;
      }

      if (cursor < template.length) {
        parts.push({ kind: "instruction", text: template.slice(cursor) });
      }

      const promptLength = parts.reduce((total, part) => total + part.text.length, 0);
      if (promptLength > maximumPromptCharacters) {
        throw new ExtensionError("prompt-too-long");
      }

      return { parts, truncatedSources: [...truncatedSources] };
    },
  };
}
