# PromptKit

A Raycast extension for reusable AI prompts. You supply an OpenAI-compatible API key. PromptKit talks to that endpoint and never calls Raycast AI.

OpenAI, OpenRouter, Ollama, and LM Studio work when they expose `/models` and `/chat/completions`. Native Anthropic and Gemini APIs do not. Neither do provider OAuth, custom headers, or Raycast's own AI providers.

The provider bills you. PromptKit has no account, credits, or billing page.

## ⚙️ Setup

Open **AI Settings**, then **Set up AI**.

- **API key.** Required. Type `local` if the server ignores auth.
- **Base URL.** Defaults to `https://api.openai.com/v1`.
- **Model.** Pick from the fetched list, or type the ID.
- **Reasoning.** Leave at provider default, or pick none, minimal, medium, high, extra high.
- **Maximum source characters.** Caps each placeholder source. Default 20,000. Allowed range is 1,000 to 100,000.

**Fetch models** while you edit the connection. **Refresh models** does the same from AI Settings. If the provider has no `GET /models`, choose **Enter manually**.

PromptKit stores the key in Raycast local storage and always sends `Authorization: Bearer <API key>`. That includes local servers where the key is just `local`.

## ⌨️ Commands

- 💬 **Ask AI** takes a question from Root Search.
- 📝 **Summarize Text** and ✨ **Polish Writing** look for text in this order: the command argument, the current selection, then a form.
- 📋 **AI Tasks** is the list of saved prompts.
- ⚙️ **AI Settings** is the provider and the global defaults.

Hotkeys live in Raycast Settings → Extensions → PromptKit.

## 📌 Tasks

A task is a prompt you save, with an icon and an optional model of its own.

**Summarize webpage** ships with the extension and cannot be edited. Duplicate it if you want a version you can change. `{browser-tab}` only works when Raycast Browser Companion is installed and enabled.

Four placeholders, matched exactly. PromptKit reads only the ones that appear in the prompt. If `{selection}` shows up twice, it reads the selection once. Any other `{...}`, including JSON, is left alone.

| Token | What it reads |
| --- | --- |
| ⌨️ `{input}` | Text you type when the task runs |
| ✏️ `{selection}` | Selected text in the frontmost app |
| 📋 `{clipboard}` | Plain text on the clipboard |
| 🌐 `{browser-tab}` | The current tab as Markdown |

```text
Summarize this for a standup. Keep it under five bullets.

{selection}
```

To put a task in Root Search, open it and choose **Create Quicklink**. No `{input}` means it runs after Raycast confirms the link. With `{input}`, you get the form first. Delete the task and that Quicklink stops. It will not silently run a different task.

## 🤖 Models

A command or task override wins. Otherwise the global model and reasoning are used.

Custom tasks set the override on the task form. Ask AI, Summarize Text, Polish Writing, and Summarize webpage use **Edit AI settings** from the Action Panel. **Use global default** clears an override. **Provider default** leaves `reasoning_effort` off the request.

Duplicating a task copies its override. Deleting the task drops it. The model list is cached for the current Base URL and forgotten when the connection changes.

## 🔒 Privacy and limits

The prompt and the resolved placeholder text go to the Base URL you configured. If that URL is remote, selected text, clipboard text, and page content leave the machine.

PromptKit does not log the key, the Authorization header, prompts, sources, model output, or provider bodies.

Requests have no tools, function calling, file access, or automatic URL fetching. PromptKit wraps placeholder content as untrusted data and tells the model not to follow instructions inside it. Hostile text can still get through.

PromptKit cuts long sources at the character limit, keeping the start and the end. The result names which placeholder was shortened. The whole prompt cannot exceed 100,000 characters. If the model still rejects the request as too large, lower the source limit.

You get a short error message, not the provider's JSON.

## 💻 Development

```sh
npm install
npm test
npm run typecheck
npm run lint
npm run build
```

`npm run dev` loads the extension in Raycast. Tests use fake keys and a local mock endpoint.
