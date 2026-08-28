# PromptKit

PromptKit runs reusable AI prompts in Raycast with your own provider credentials. It sends requests directly to an OpenAI-compatible endpoint and does not use Raycast AI.

## Current status

The current build includes the planned v1 feature set:

- Five Raycast commands for asking questions, editing text, managing tasks, and configuring the provider.
- Streaming Chat Completions responses with cancellation and regeneration.
- Global model and reasoning settings, plus overrides for each command or task.
- Custom prompt tasks with icons, placeholders, duplication, deletion, and Quicklinks.
- Model discovery through `GET /models`, local caching, and manual model entry.
- Automated tests for settings, streaming, placeholders, task storage, Browser Companion, and Quicklinks.

PromptKit currently supports OpenAI-compatible APIs only. It does not support native Anthropic or Gemini APIs, provider OAuth, custom request headers, or Raycast's built-in AI providers.

## Set up PromptKit

Open **AI Settings** in Raycast and choose **Set up AI**. Configure these fields:

- **API key:** Your provider key. If a local endpoint ignores authentication, enter `local`.
- **Base URL:** The OpenAI-compatible API root. The default is `https://api.openai.com/v1`.
- **Model:** Choose a model returned by the provider or enter its exact ID manually.
- **Reasoning:** Use the provider default or request `none`, `minimal`, `medium`, `high`, or `extra high`.
- **Maximum source characters:** The limit for each dynamic source. The default is `20,000`; valid values range from `1,000` to `100,000`.

Use **Fetch models** while editing the provider connection or **Refresh models** from AI Settings. If the provider does not expose `GET /models`, select **Enter manually** and type the model ID.

PromptKit stores the provider configuration in Raycast local storage. Every model request includes `Authorization: Bearer <API key>`, including requests to local endpoints that use `local` as the key.

OpenAI, OpenRouter, Ollama, LM Studio, and other services can work if they expose compatible `/models` and `/chat/completions` endpoints. Your provider may charge for requests. PromptKit does not manage provider accounts, credits, or billing.

## Commands

- **Ask AI** answers a question passed from Raycast Root Search.
- **Summarize Text** uses its command argument, then selected text, then an input form.
- **Polish Writing** follows the same input order and returns text that you can copy or paste.
- **AI Tasks** lets you create, search, run, edit, duplicate, and delete saved prompt tasks. Each task can use a Raycast icon.
- **AI Settings** configures the provider connection, global model, reasoning level, and source limit.

Set a global hotkey for any command in Raycast Settings under Extensions, then PromptKit.

## Models and overrides

Every request uses the task or command override when one exists. Otherwise it uses the global model and reasoning settings.

- Edit a custom task to set its model and reasoning override.
- Open **Edit AI settings** from a static command or read-only built-in task to set its override.
- Choose **Use global default** to remove an override.
- Choose **Provider default** to omit `reasoning_effort` from the request.

Duplicating a task copies its override. Deleting a custom task removes its override. PromptKit caches the model list for the configured Base URL and clears that cache when the provider connection changes.

## Run a task from Root Search

Open a task's Action Panel in **AI Tasks**, then choose **Create Quicklink**. Raycast opens a Quicklink form with the task name and PromptKit deeplink filled in. Save it to make the task available from Root Search or assign it a hotkey.

A task without `{input}`, such as **Summarize webpage**, starts after Raycast confirms the deeplink. A task with `{input}` opens its input form first. If you delete the custom task, its Quicklink shows a task-not-found message instead of running another task.

## Task placeholders

Tasks support four exact placeholders:

- `{input}` asks for text when you run the task.
- `{selection}` reads selected text from the frontmost app.
- `{clipboard}` reads plain text from the clipboard.
- `{browser-tab}` reads Markdown from the current tab through Raycast Browser Companion.

PromptKit reads only the sources named in the prompt. Repeated placeholders reuse the same source read during that run. Other braces stay unchanged, so JSON examples remain intact.

The built-in **Summarize webpage** task demonstrates `{browser-tab}`. It is read-only. Duplicate it to make an editable copy. Install and enable Raycast Browser Companion in a supported browser before using browser content.

## Results

PromptKit streams model output into a Raycast Detail view. The result actions let you:

- Cancel an active generation.
- Copy or paste the generated text.
- Regenerate the result.
- Edit a custom task.
- Edit the command or built-in task override.
- Open the global AI settings.

If PromptKit shortens a source, the result identifies which placeholder was affected.

## Data and privacy

PromptKit sends the task prompt and resolved placeholder content directly to the Base URL in AI Settings. Selected text, clipboard text, and webpage content leave Raycast when the configured provider is remote. Raycast AI does not process these requests.

The API key and settings stay in Raycast local storage. The extension does not log API keys, authorization headers, prompts, source content, model output, or provider response bodies.

Requests do not include tools, function calling, file access, or automatic URL fetching. PromptKit labels placeholder content as untrusted data and tells the model not to follow instructions inside it. This reduces prompt-injection risk, but a model can still mishandle hostile source text.

## Limits and errors

PromptKit shortens each dynamic source at the configured character limit while preserving its beginning and end. It rejects a resolved prompt over `100,000` characters. A provider may have a smaller context window, so lower the source limit if the provider rejects a request as too large.

The extension uses fixed messages for missing configuration, invalid URLs, authentication failures, missing models, rate limits, context limits, network failures, empty sources, Browser Companion access, and deleted tasks. It does not display raw provider response bodies.

## Development

```sh
npm install
npm test
npm run typecheck
npm run lint
npm run build
```

Use `npm run dev` to open the extension in Raycast during development.

Tests use fake keys and local mock OpenAI-compatible endpoints. They do not call a live provider.
