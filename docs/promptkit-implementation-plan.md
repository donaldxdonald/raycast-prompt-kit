# PromptKit implementation plan

## 1. 产品方向

PromptKit 是一个运行在 Raycast 中的轻量 BYOK AI 工具。它不依赖 Raycast AI，也不调用 `AI.ask()` 或 `useAI()`。用户提供模型凭证，在 Raycast 中运行常见文本任务，也可以保存自己的 Prompt Task。

第一版解决四件事：

- 快速向模型提问。
- 总结或润色输入内容。
- 创建和运行自定义 Prompt Task。
- 在 Prompt 中使用 `{input}`、`{selection}`、`{clipboard}` 和 `{browser-tab}` 等动态内容。

网页总结不再是产品本身，而是自定义 Task 的一个示例：

```text
Title: Summarize Webpage

Prompt:
Summarize the following webpage. Start with a one-sentence overview,
then list the main points and any concrete conclusions.

{browser-tab}
```

运行这个 Task 时，PromptKit 才调用 Browser Companion。没有 `{browser-tab}` 的 Task 不请求浏览器内容。

## 2. 命名建议

不建议使用 `Quick AI`。Raycast 已经把这个名字用于自己的 AI 功能。相同名称会让用户误以为扩展能调用 Raycast AI，也会让设置、错误提示和文档变得含糊。

推荐工作名为 `PromptKit`：

- 名字指向 Prompt 和 Task，不绑定某一家模型。
- 适合“内置常用任务，加自定义任务”的产品结构。
- 不暗示拥有 Raycast Quick AI 的聊天或账号能力。

备选名称：

| 名称          | 优点                          | 问题                                  |
| ------------- | ----------------------------- | ------------------------------------- |
| PromptKit     | 简短，能容纳内置和自定义 Task | 发布前需要检查 Store 和商标重名       |
| BYOK AI       | 一眼能看懂凭证模式            | 偏技术配置项，不像产品名              |
| OpenPrompt    | 能表达 Provider 自由          | “Open”可能被理解为开源或仅支持 OpenAI |
| Prompt Runner | 含义准确                      | 名字较普通，辨识度低                  |

计划后续统一使用 `PromptKit` 作为工作名。Store 发布前再做一次正式的名称冲突检查。

## 3. 产品术语

为了符合 Raycast 的运行方式，界面使用以下术语：

- `Command`：写在 Extension manifest 中，能出现在 Raycast Root Search 的静态入口。
- `Task`：用户在 PromptKit 内保存的 Prompt 模板。Task 不会动态变成 Root Search Command。
- `Placeholder`：运行 Task 时解析的动态内容，例如 `{selection}` 或 `{browser-tab}`。
- `Provider`：用户选择的模型服务。第一版只有 OpenAI-compatible protocol。

这个区别不能省略。Raycast Extension 无法在运行时向 manifest 添加 Command。自定义 Task 通过 `AI Tasks` Command 打开，可以在列表中搜索、运行和管理。用户可以为 Task 创建 Raycast Quicklink，让它出现在 Root Search 并单独绑定快捷键；Quicklink 仍然不是动态 Command。

## 4. 第一版范围

### Root Search Commands

第一版提供五个静态 Commands：

1. `Ask AI`
   - 接收一个问题。
   - 流式显示回答。

2. `Summarize Text`
   - 输入优先级为 command argument、当前选中文本、输入 Form。
   - 使用内置总结 Prompt。

3. `Polish Writing`
   - 输入优先级与 `Summarize Text` 相同。
   - 默认保留原意、语言和基本结构。
   - 结果页提供复制和粘贴 Action。

4. `AI Tasks`
   - 显示可搜索的 Task 列表，`Enter` 运行当前 Task。
   - Task 需要 `{input}` 时再显示输入 Form。
   - Action Panel 提供创建、编辑、复制、删除、配置内置 Task AI settings 和创建 Quicklink。
   - 提供内置示例 `Summarize Webpage`，用户可复制后修改。

5. `AI Settings`
   - 集中配置 API Key、Base URL、全局默认模型、reasoning level 和来源字符上限。
   - 从配置的 OpenAI-compatible provider 请求 `GET /models`。
   - 首次保存 Provider 后自动请求模型；已有本地缓存时不自动请求。
   - 自定义 Task override 在 Task Form 中编辑。
   - `Ask AI`、`Summarize Text`、`Polish Writing` 和只读内置 Task 通过各自 Action Panel 中的 `Edit AI settings` 编辑 override。
   - 提供手动刷新模型列表的 Action。

### BYOK 配置

PromptKit 不声明 Extension preferences。AI Settings 将完整配置保存在 Raycast 的本地加密数据库中。API Key 必填；对于忽略认证的本地 endpoint，填写 `local`。Base URL 默认 `https://api.openai.com/v1`。`Maximum source characters` 默认 `20,000`，只接受 `1,000` 到 `100,000` 之间的整数。

第一版只支持 OpenAI Chat Completions compatible protocol。可连接 OpenAI、OpenRouter、Ollama、LM Studio 和其他兼容服务。

不支持：

- Raycast 自带 BYOK 配置。
- Provider 账号登录或 OAuth。
- 任意自定义请求 Header。
- Anthropic 和 Gemini 原生协议。

第一版始终发送 `Authorization: Bearer <API Key>`。OpenAI-compatible 本地服务通常会忽略该值，因此可以使用 `local`。不实现“空 Key 时移除 Authorization Header”的特殊 transport。

模型请求依次使用 Command 或 AI Task override、全局默认。`Provider default` 不发送 `reasoning_effort`。

## 5. Placeholder 设计

第一版实现一个刻意缩小的 Placeholder grammar，不尝试复制 Raycast Dynamic Placeholders 的全部语法。

| Placeholder     | 解析内容                                    | 失败行为                                     |
| --------------- | ------------------------------------------- | -------------------------------------------- |
| `{input}`       | Task 运行时输入                             | 打开输入 Form；提交空白内容时阻止运行        |
| `{selection}`   | 当前应用选中的文本                          | 显示“Select some text and try again”         |
| `{clipboard}`   | 剪贴板中的纯文本                            | 空剪贴板时显示可操作错误                     |
| `{browser-tab}` | Browser Companion 提取的当前标签页 Markdown | Companion 或页面不可访问时显示安装或重试说明 |

实现规则：

- 只替换完全匹配的四个 token。Prompt 中其他花括号原样保留，因此 JSON 示例不会被破坏。
- 一个 Placeholder 出现多次时只读取一次来源，然后复用结果。
- 只解析 Prompt 实际使用的 Placeholder。
- 多种 Placeholder 可以出现在同一个 Prompt 中。
- 解析完成后再发起模型请求。任何来源失败时不发送残缺 Prompt。
- `{browser-tab}` 第一版固定为 Markdown，不支持 `format` 和 `selector` attributes。
- 每个 Placeholder 来源受 `Maximum source characters` 限制，最终 Prompt 还有应用级硬上限。

不要把 Raycast 的 `{browser-tab}` 直接传给模型。普通 Extension 不会获得 Raycast AI Command 的内建 Placeholder 展开。PromptKit 必须通过 `BrowserExtension.getContent({ format: "markdown" })` 自己解析它。

## 6. 输入体验

### 内置文本 Commands

`Summarize Text` 和 `Polish Writing` 使用同一个输入解析顺序：

1. 如果 command argument 有非空文本，直接使用。
2. 否则尝试读取当前应用选中的文本。
3. 如果没有选中文本，显示一个 `Form.TextArea`。

这个规则集中在一个模块中，不在两个 Commands 里复制。

### 自定义 Task

- 没有 `{input}` 时直接运行。
- 有 `{input}` 时先显示输入 Form。
- `{selection}`、`{clipboard}` 和 `{browser-tab}` 在提交后解析。
- Task 编辑页显示支持的 Placeholder 列表，并提供插入示例，避免要求用户记语法。
- Task 可以创建指向 `AI Tasks` Command 的 Quicklink。Quicklink 通过 deeplink `context` 传递 Task id，不把 Task 动态注册为 Command。
- 从 Quicklink 启动时，没有 `{input}` 的 Task 直接运行；有 `{input}` 的 Task 先显示输入 Form。Task 已删除时显示失效说明。

### 输出体验

所有任务使用 Raycast `Detail` 流式显示 Markdown。Action Panel 根据任务类型提供：

- `Copy Result`
- `Paste Result`
- `Regenerate`
- `Edit Task`，仅自定义 Task 显示
- `Open AI Settings`

`Paste Result` 使用 Raycast 提供的粘贴 Action。第一版不自动替换选中文本，以免生成失败或焦点变化时覆盖原内容。

## 7. 数据模型

```ts
type AITask = {
  id: string;
  title: string;
  description?: string;
  prompt: string;
  icon: TaskIcon;
  createdAt: string;
  updatedAt: string;
};

type TaskInput = Pick<AITask, "title" | "description" | "prompt" | "icon">;
```

约束：

- `id` 使用 `crypto.randomUUID()`。
- `title` 和 `prompt` 去除首尾空白后不能为空。
- title 不要求唯一，列表中用 id 识别记录。
- 新建和编辑 Task 时可以选择 Raycast icon；旧记录没有 icon 时使用 Text。
- Task 的模型和 reasoning override 存在独立的 AI Settings 存储中，不改变 Task prompt 数据结构。
- 创建和编辑 Task 时在同一个 Form 中配置模型和 reasoning。复制 Task 时复制 override，删除 Task 时一并清理。
- LocalStorage 按 Task ID 和 target 分键存储，避免不同 Command 的并发更新覆盖整份数据。
- 旧 `aiTasks.v1` 记录在读取边界迁移；缺少 icon 的旧记录补为 Text，应用内的 `AITask.icon` 始终存在。
- 读取存储后验证字段。损坏的单条记录应跳过并报告，不能让整个列表无法打开。

内置示例不直接写入用户存储。`built-in-tasks.ts` 返回只读定义，用户执行 `Duplicate Task` 后才创建可编辑副本。

## 8. 模块设计

```text
src/
  ask-ai.tsx
  summarize-text.tsx
  polish-writing.tsx
  ai-tasks.tsx
  select-model.tsx
  lib/
    ai-runner.ts
    model-client.ts
    ai-settings.ts
    input-source.ts
    placeholder-resolver.ts
    browser-content.ts
    task-store.ts
    built-in-tasks.ts
    extension-error.ts
  ui/
    ai-settings-form.tsx
    ai-result.tsx
    text-input-form.tsx
    task-form.tsx
  types.ts
tests/
  ai-runner.test.ts
  placeholder-resolver.test.ts
  task-store.test.ts
  model-client.test.ts
  ai-settings.test.ts
```

不创建 `utils.ts`、`helpers.ts` 或为每个 Placeholder 建一个只有几行的文件。

### `ai-runner.ts`

这是所有 Commands 共用的深模块。调用者只提供 Task、可选 input 和流式回调：

```ts
type RunAIInput = {
  task: Pick<AITask, "id" | "title" | "prompt">;
  input?: string;
  signal: AbortSignal;
  onDelta: (delta: string) => void;
};

type RunAIResult = {
  text: string;
  truncatedSources: PlaceholderName[];
};

async function runAITask(input: RunAIInput): Promise<RunAIResult>;
```

实现隐藏以下行为：

- 解析 Placeholder。
- 应用内容长度限制。
- 构造安全的 model messages。
- 调用模型并转发 stream delta。
- 记录内容是否被截断。
- 将底层错误转换成稳定错误码。

内置 Commands 也先转换成 Task 定义，再调用此接口。它们不各自实现模型请求。

### `model-client.ts`

- 通过 `ai-settings.ts` 的单一 interface 异步解析当前 target 的完整请求配置。
- 使用 `@xsai/stream-text` 处理 OpenAI-compatible streaming，并用 `@xsai/shared` 映射结构化错误。
- 显式观察 xsAI 的 metadata promises，避免只消费 `textStream` 时产生未处理 rejection。
- 使用 Chat Completions streaming，不自行解析 SSE。
- 支持 `AbortSignal`。
- 映射认证、model 不存在、限流、context length、网络和未知错误。
- 不输出 API Key、Authorization Header、网页正文或完整 provider response。

### `ai-settings.ts`

- 在 Raycast 的本地加密数据库中持久化 API Key、Base URL、全局默认和来源字符上限。
- 使用 `@xsai/model` 从 `<Base URL>/models` 读取模型。
- 按模型 ID 排序，供全局、Command 和 Task 设置 Form 选择。
- 本地缓存模型 ID。没有缓存时自动查询；已有缓存时直接读取，只有用户执行 `Refresh models` 才重新请求并覆盖缓存。
- 按 target 分键持久化 override。
- 集中解析 target override 和全局默认的优先级。
- 集中复制和删除 target override。

第一版不建立 `ProviderAdapter` interface。只有一个协议时，这个 seam 是假的。加入第二个原生协议后再建立统一 interface。

### `placeholder-resolver.ts`

Placeholder resolver 保留 Task 指令和动态来源的区别，不能提前把它们压成一个字符串：

```ts
type PlaceholderName = "input" | "selection" | "clipboard" | "browser-tab";

type ResolvedPromptPart =
  | { kind: "instruction"; text: string }
  | {
      kind: "source";
      source: PlaceholderName;
      text: string;
      truncated: boolean;
    };

type ResolvedPrompt = {
  parts: ResolvedPromptPart[];
  truncatedSources: PlaceholderName[];
};

type PlaceholderSources = {
  getSelection(signal: AbortSignal): Promise<string>;
  getClipboard(signal: AbortSignal): Promise<string>;
  getBrowserTab(signal: AbortSignal): Promise<string>;
};

function createPlaceholderResolver(sources: PlaceholderSources): {
  resolve(template: string, context: { input?: string; signal: AbortSignal }): Promise<ResolvedPrompt>;
};
```

生产环境传入 Raycast sources，测试传入 spies。这个 internal seam 允许测试按需读取和单次缓存，Commands 仍只通过 `ai-runner.ts` 使用 resolver。

模块内部维护 token 到 source 的映射。它负责：

- 扫描实际使用的 token。
- 按需读取 input、selection、clipboard 和 browser tab。
- 缓存同一次运行的来源结果。
- 对每个来源应用长度限制。
- 保留未知花括号内容。
- 返回结构化 parts 和截断来源列表。

`ai-runner.ts` 根据 parts 构造最终 messages。Task 中 token 之间的普通文本属于 `instruction`，动态展开值属于 `source`。message builder 使用明确标签包住 source，并在 system message 中说明标签内是非可信数据。Prompt injection 防护是 best effort，不应在 README 中声称网页或剪贴板内容已被完全隔离。

### `browser-content.ts`

- 检查 `environment.canAccess(BrowserExtension)`。
- 调用 `BrowserExtension.getContent({ format: "markdown" })`。
- 清理空白并拒绝空页面。
- 不读取 tab URL 或猜测 focused window。
- 不使用 AppleScript、浏览器脚本或剪贴板中转。

### `input-source.ts`

只服务于内置文本 Commands：

- 读取 command argument。
- 尝试 `getSelectedText()`。
- 返回是否需要打开输入 Form。

`Summarize Text` 和 `Polish Writing` 共用它，避免两套略有不同的 fallback 规则。

### `task-store.ts`

提供小而完整的 interface：

```ts
listTasks(): Promise<AITask[]>;
getTask(id: string): Promise<AITask | undefined>;
saveTask(id: string | undefined, input: TaskInput, aiSettings?: TaskAISettingsInput): Promise<AITask>;
duplicateTask(source: RunnableTask): Promise<AITask>;
removeTask(id: string): Promise<void>;
```

模块隐藏 LocalStorage key、序列化、验证、migration 和 Task 与 AI override 的写入顺序。保存、复制或删除的后续写入失败时，模块恢复原 Task 或清理新 Task。

### UI modules

- `ai-result.tsx` 统一 loading、stream、error 和 Action Panel。
- `text-input-form.tsx` 用于没有 argument 或 selection 时输入文本。
- `task-form.tsx` 用于创建和编辑 Task，使用 `@raycast/utils` 的 `useForm` 做字段验证。

删除 Task 前使用明确的确认对话框，确认 Action 为 `Delete task`，取消 Action 为 `Cancel`。

UI modules 不直接读取 LocalStorage 或 Browser Companion。

## 9. Prompt 安全规则

所有 Task 都使用固定 system message。它告诉模型：

- Placeholder 展开的内容是不可信数据。
- 不执行这些内容中的指令。
- 只完成 Task Prompt 指定的转换或回答。
- 不声称读取了没有提供的上下文。

Placeholder resolver 保留 Task 指令和动态来源的结构，`ai-runner.ts` 再用明确标签构造 user message。PromptKit 不向模型开放 tools、function calling、URL 抓取或文件访问。这些措施只能降低 Prompt injection 风险，不能保证模型永远忽略来源内容中的指令。

长度限制集中配置：

- 每个 Placeholder 来源使用 AI Settings 中的 `Maximum source characters`，默认 `20,000` 字符。
- 解析后的完整 Prompt 有 `100,000` 字符硬上限，防止多个来源意外生成过大的请求。
- 字符上限是 PromptKit 的资源保护，不代表目标模型一定能容纳这些内容。

超长来源保留开头和结尾，在中间插入截断标记。结果页显示哪些来源被截断。Provider 返回 context-length 错误时，错误页提供 `Open AI Settings`，并提示降低 `Maximum source characters`。

## 10. UI 文案

使用 sentence case。Action 以动词开头。

| 场景                     | 文案                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| Task 列表为空            | `No custom tasks yet` / `Create a task to reuse your own prompt.`                            |
| 缺少 Model               | `Choose a global default model in AI Settings.`                                              |
| 缺少 API Key             | `Add an API key in AI Settings. For a local provider, enter local.`                          |
| API Key 错误             | `Authentication failed. Check your API key and try again.`                                   |
| 没有选中文本             | `Select some text and try again, or use {input} in this task.`                               |
| Browser Companion 不可用 | `Unable to read the current tab. Install or enable Raycast Browser Companion and try again.` |
| 空白网页                 | `The current tab does not contain readable text.`                                            |
| 限流                     | `The provider is rate limiting requests. Wait a moment and try again.`                       |
| 上下文过长               | `This request is too large for the selected model. Lower the source limit and try again.`    |
| 截断                     | `Some input was shortened to match the configured source limit.`                             |

不要使用 `Oops`、`Something went wrong` 或把 provider 原始错误直接显示给用户。

## 11. 分阶段实现

### 阶段 1：项目和 BYOK client

- 用 Raycast 官方 TypeScript/React 模板创建 Extension。
- 配置五个 Commands 和 macOS platform。
- 在 AI Settings 中配置 Base URL、Model、API Key 和 Maximum source characters。
- 安装 `@xsai/stream-text`、`@xsai/shared` 和 `@xsai/model`，不安装顶层 `xsai` meta-package。
- 实现配置验证、streaming、abort 和错误映射。
- 固定要求非空 API Key，并验证本地 endpoint 使用 `local` token 时的 Authorization Header。
- 用 mock OpenAI-compatible endpoint 验证，不使用真实 Key 运行自动测试。

验收：model client 可以通过自定义 Base URL 取得流式回答；缺少或无效的 Key、Model 和 endpoint 有稳定错误码。

### 阶段 2：结构化 Placeholder core

- 定义 `ResolvedPromptPart`、`ResolvedPrompt` 和 `PlaceholderSources`。
- 实现 `createPlaceholderResolver()`，第一步只支持 `{input}`。
- 保留普通 instruction 和动态 source 的结构。
- 实现按需读取、单次缓存、source limit 和完整 Prompt 硬上限。
- 通过 spies 验证未使用的 source 不会执行。

验收：`{input}` 能解析为结构化 source；未知花括号保持不变；截断信息可由调用者读取。

### 阶段 3：统一 runner、Ask AI 和结果 UI

- 实现 `runAITask()`、`RunAIResult` 和固定 system message。
- 把结构化 Prompt parts 转换为带明确标签的 model messages。
- 实现 `AIResult` 的 loading、stream、success、partial failure 和 cancelled 状态。
- 添加 Copy、Paste、Regenerate 和 Open AI Settings Actions。
- 实现 `Ask AI`。

验收：`Ask AI` 可以通过自定义 Base URL 流式显示回答；所有请求经过同一 runner；重新生成会先取消旧请求；旧 stream 不会写入新结果。

### 阶段 4：内置文本 Commands

- 实现 argument、selection、Form 的输入顺序。
- 添加 `Summarize Text` 和 `Polish Writing` 的内置 Task 定义。
- 为 `Polish Writing` 提供粘贴 Action，但不自动替换选中文本。

验收：三个内置 Commands 都可以用 Root Search 和全局快捷键运行；Summarize 和 Polish 在没有 argument 或 selection 时打开输入 Form。

### 阶段 5：Task 管理

- 实现 `task-store.ts` 和数据验证。
- 实现可搜索的 `AI Tasks` 列表，`Enter` 运行当前 Task。
- 在同一列表的 Action Panel 实现创建、编辑、复制和删除。
- 使用 `Action.CreateQuicklink` 为内置示例和自定义 Task 生成预填名称与 deeplink 的 Quicklink。
- 复制通过 `task-store.ts` 复制 Task 和对应 override。

验收：使用 `{input}` 的自定义 Task 可以运行；Task 重启 Raycast 后仍存在；损坏记录不会阻止其他 Task 加载；保存的 Quicklink 可以从 Root Search 启动对应 Task。

### 阶段 6：外部内容 Placeholders

- 增加 `{selection}`、`{clipboard}` 和 `{browser-tab}` sources。
- 接入 Browser Companion。
- Task 表单展示 Placeholder 说明。
- 添加只读示例 `Summarize Webpage`。

验收：只有包含对应 Placeholder 的 Task 才读取 selection、clipboard 或 browser tab；同一 source 重复出现只读取一次；其他 JSON 花括号不受影响；网页总结示例必须复制后才能修改。

### 阶段 7：验证和文档

- 完成单元测试、mock endpoint 集成测试和 Raycast 内手动测试。
- 运行 lint、typecheck、test 和 build。
- 编写 README，说明 BYOK、Provider 费用、数据流、Browser Companion 和全局快捷键设置。
- 明确网页和选中文本会直接发送给用户配置的 Provider。
- 给五个 Commands 添加准确的 title、description 和 icon。

验收：一个新用户可在十分钟内配置 Provider、运行内置 Command，并创建一个使用 `{browser-tab}` 的自定义 Task。

## 12. 测试计划

### 单元测试

- argument、selection、Form 的输入优先级。
- 四个 Placeholder 的识别和替换。
- 未使用的来源不会读取。
- 同一来源每次运行只读取一次。
- 未知花括号和 JSON 示例保持不变。
- 来源和总 Prompt 截断。
- Task 创建、更新、复制、删除和损坏数据恢复。
- Task Quicklink 的 deeplink path 和 `context` 编码。
- 结构化 Prompt 能区分 instruction 和每种 source。
- `Maximum source characters` 的默认值、范围校验和截断行为。
- SDK 错误到稳定错误码的映射。
- stream 顺序、abort 和重复生成。
- `/models` 请求 path、Authorization Header、模型缓存和手动刷新、设置迁移、继承优先级、reasoning 和 Base URL 隔离。

### 集成测试

- mock OpenAI-compatible streaming endpoint。
- 验证请求 path、Authorization Header、model、messages 和 stream。
- 验证本地 endpoint 使用 `local` token，并收到稳定的 Authorization Header。
- 覆盖 401、404、429、context length、断流和 malformed stream。
- 集成测试只使用假 Key。

### Raycast 手动测试

- 有 command argument。
- 有选中文本。
- 没有输入时打开 Form。
- 剪贴板为空。
- Browser Companion 未安装。
- Safari 和 Chromium 当前标签页。
- 动态网页和空白页面。
- 长网页截断。
- 生成中关闭视图或连续重新生成。
- OpenAI-compatible 云端 Provider 和本地 Provider 各一个。
- `AI Settings` 的全局默认、Task Form override、Command 的 `Edit AI settings`、手动模型和 provider 不支持 `/models` 状态。

## 13. 隐私与安全

- API Key 只存在 Raycast 的本地加密数据库，表单使用 PasswordField。
- 不记录 Key、Authorization Header、Prompt 展开内容或模型输出。
- 只有用户主动运行 Command 时才读取 selection、clipboard 或 browser tab。
- Placeholder 按需解析，不提前收集所有来源。
- README 清楚说明数据直接发送给用户配置的 Provider，Raycast AI 不参与。
- 模型请求没有 tools 或 function calling。
- provider 错误先脱敏，再转换为固定错误文案。

## 14. Definition of done

第一版完成必须满足：

- 免费 Raycast 用户可在 macOS 上使用，不依赖任何 Raycast AI 接口。
- 用户能在 AI Settings 中配置 OpenAI-compatible Base URL、全局默认模型和 API Key。
- 用户能配置全局默认 reasoning，在各 Command Action Panel 或 Task Form 中设置 override。
- 用户能调整 `Maximum source characters`，无效值会在请求前被拒绝。
- `Ask AI`、`Summarize Text`、`Polish Writing` 能独立运行。
- 用户能创建、编辑、复制、删除和运行 Task。
- 用户能为 Task 创建 Quicklink，并从 Root Search 直接启动。
- `{input}`、`{selection}`、`{clipboard}`、`{browser-tab}` 正常解析。
- 网页总结通过自定义 Task 完成，不存在专用网页总结实现分支。
- 模型结果流式显示，支持复制、粘贴和重新生成。
- Companion、配置、认证、限流和内容过长错误有可执行的处理办法。
- API Key 和动态内容不进入日志或明文文件。
- lint、typecheck、test 和 build 全部通过。

## 15. 后续版本候选

由真实使用反馈决定：

- Task 导入与导出。
- Anthropic Messages adapter。
- Gemini GenerateContent adapter。
- 更多 Placeholder，例如当前日期和当前应用。
- Task 使用历史。
- 继续追问和轻量会话。
- Raycast Store 发布与正式名称确认。

加入第二种原生模型协议时，再建立统一的模型客户端 interface。OpenAI-compatible、Anthropic 和 Gemini 各自作为 adapter，`ai-runner.ts` 与所有 Commands 保持不变。
