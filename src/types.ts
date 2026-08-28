export const TASK_ICON_VALUES = [
  "text",
  "stars",
  "wand",
  "message",
  "document",
  "paragraph",
  "pencil",
  "globe",
  "book",
  "search",
  "light-bulb",
  "code",
  "terminal",
  "checklist",
  "clipboard",
  "image",
  "bolt",
  "calculator",
  "calendar",
  "envelope",
  "chart",
] as const;

export type TaskIcon = (typeof TASK_ICON_VALUES)[number];

export const DEFAULT_TASK_ICON: TaskIcon = "text";

export function isTaskIcon(value: unknown): value is TaskIcon {
  return typeof value === "string" && TASK_ICON_VALUES.some((icon) => icon === value);
}

export type AITask = {
  id: string;
  title: string;
  description?: string;
  prompt: string;
  icon: TaskIcon;
  createdAt: string;
  updatedAt: string;
};

export type TaskInput = Pick<AITask, "title" | "description" | "prompt" | "icon">;

export type AITaskDefinition = Pick<AITask, "id" | "title" | "prompt">;

export type RunnableTask = AITaskDefinition & Pick<AITask, "description" | "icon">;

export type PlaceholderName = "input" | "selection" | "clipboard" | "browser-tab";

export type ResolvedPromptPart =
  | { kind: "instruction"; text: string }
  | {
      kind: "source";
      source: PlaceholderName;
      text: string;
      truncated: boolean;
    };

export type ResolvedPrompt = {
  parts: ResolvedPromptPart[];
  truncatedSources: PlaceholderName[];
};

export type PlaceholderSources = {
  getSelection(signal: AbortSignal): Promise<string>;
  getClipboard(signal: AbortSignal): Promise<string>;
  getBrowserTab(signal: AbortSignal): Promise<string>;
};

export type RunAIInput = {
  task: AITaskDefinition;
  input?: string;
  signal: AbortSignal;
  onDelta: (delta: string) => void;
};

export type RunAIResult = {
  text: string;
  truncatedSources: PlaceholderName[];
};
