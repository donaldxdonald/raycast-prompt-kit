import { Icon } from "@raycast/api";

import { TASK_ICON_VALUES, type TaskIcon } from "../types";

const TASK_ICON_METADATA: Record<TaskIcon, { title: string; icon: Icon; keywords?: string[] }> = {
  text: { title: "Text", icon: Icon.Text },
  stars: { title: "Stars", icon: Icon.Stars, keywords: ["AI", "sparkle"] },
  wand: { title: "Magic wand", icon: Icon.Wand, keywords: ["AI", "generate"] },
  message: { title: "Message", icon: Icon.Message, keywords: ["chat", "question"] },
  document: { title: "Document", icon: Icon.Document, keywords: ["file", "page"] },
  paragraph: { title: "Paragraph", icon: Icon.Paragraph, keywords: ["summary", "writing"] },
  pencil: { title: "Pencil", icon: Icon.Pencil, keywords: ["edit", "write"] },
  globe: { title: "Globe", icon: Icon.Globe, keywords: ["web", "website"] },
  book: { title: "Book", icon: Icon.Book, keywords: ["read", "research"] },
  search: { title: "Search", icon: Icon.MagnifyingGlass, keywords: ["find", "research"] },
  "light-bulb": { title: "Light bulb", icon: Icon.LightBulb, keywords: ["idea"] },
  code: { title: "Code", icon: Icon.Code, keywords: ["programming", "developer"] },
  terminal: { title: "Terminal", icon: Icon.Terminal, keywords: ["shell", "command"] },
  checklist: { title: "Checklist", icon: Icon.CheckList, keywords: ["tasks", "review"] },
  clipboard: { title: "Clipboard", icon: Icon.Clipboard, keywords: ["copy", "paste"] },
  image: { title: "Image", icon: Icon.Image, keywords: ["picture", "photo"] },
  bolt: { title: "Bolt", icon: Icon.Bolt, keywords: ["quick", "action"] },
  calculator: { title: "Calculator", icon: Icon.Calculator, keywords: ["math", "numbers"] },
  calendar: { title: "Calendar", icon: Icon.Calendar, keywords: ["date", "schedule"] },
  envelope: { title: "Envelope", icon: Icon.Envelope, keywords: ["email", "mail"] },
  chart: { title: "Chart", icon: Icon.BarChart, keywords: ["data", "analysis"] },
};

export const TASK_ICON_OPTIONS = TASK_ICON_VALUES.map((value) => ({ value, ...TASK_ICON_METADATA[value] }));

export function getTaskIcon(icon: TaskIcon): Icon {
  return TASK_ICON_METADATA[icon].icon;
}
