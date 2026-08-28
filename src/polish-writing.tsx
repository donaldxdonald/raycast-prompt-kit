import type { LaunchProps } from "@raycast/api";

import { POLISH_WRITING_TASK } from "./lib/built-in-tasks";
import { TextInputCommand } from "./ui/text-input-form";

type TextArguments = {
  text?: string;
};

export default function PolishWriting(props: LaunchProps<{ arguments: TextArguments }>) {
  return (
    <TextInputCommand argument={props.arguments.text} task={POLISH_WRITING_TASK} placeholder="Paste text to polish" />
  );
}
