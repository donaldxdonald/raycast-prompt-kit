import type { LaunchProps } from "@raycast/api";

import { SUMMARIZE_TEXT_TASK } from "./lib/built-in-tasks";
import { TextInputCommand } from "./ui/text-input-form";

type TextArguments = {
  text?: string;
};

export default function SummarizeText(props: LaunchProps<{ arguments: TextArguments }>) {
  return (
    <TextInputCommand
      argument={props.arguments.text}
      task={SUMMARIZE_TEXT_TASK}
      placeholder="Paste text to summarize"
    />
  );
}
