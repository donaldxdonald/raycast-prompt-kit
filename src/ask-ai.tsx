import type { LaunchProps } from "@raycast/api";

import { ASK_AI_TASK } from "./lib/built-in-tasks";
import { AIResult } from "./ui/ai-result";

type AskAIArguments = {
  question: string;
};

export default function AskAI(props: LaunchProps<{ arguments: AskAIArguments }>) {
  return <AIResult task={ASK_AI_TASK} input={props.arguments.question.trim()} />;
}
