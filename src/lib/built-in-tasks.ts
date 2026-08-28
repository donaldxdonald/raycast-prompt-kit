import type { RunnableTask } from "../types";

export type { RunnableTask } from "../types";

export const ASK_AI_TASK: RunnableTask = {
  id: "built-in.ask-ai",
  title: "Ask AI",
  icon: "message",
  prompt: "Answer the question in the source below.\n\n{input}",
};

export const SUMMARIZE_TEXT_TASK: RunnableTask = {
  id: "built-in.summarize-text",
  title: "Summarize text",
  icon: "paragraph",
  prompt:
    "Summarize the source text. Start with a one-sentence overview, then list the main points and concrete conclusions.\n\n{input}",
};

export const POLISH_WRITING_TASK: RunnableTask = {
  id: "built-in.polish-writing",
  title: "Polish writing",
  icon: "pencil",
  prompt:
    "Polish the source text while preserving its meaning, language, and basic structure. Return only the revised text.\n\n{input}",
};

export const BUILT_IN_TASKS: readonly RunnableTask[] = [
  {
    id: "built-in.summarize-webpage",
    title: "Summarize webpage",
    icon: "globe",
    description: "Summarize the current browser tab with Browser Companion.",
    prompt:
      "Summarize the following webpage. Start with a one-sentence overview, then list the main points and any concrete conclusions.\n\n{browser-tab}",
  },
];
