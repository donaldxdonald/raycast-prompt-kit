import { describe, expect, it, vi } from "vitest";

import { createPlaceholderResolver } from "../src/lib/placeholder-resolver";

function createSources() {
  return {
    getSelection: vi.fn(async () => "selected text"),
    getClipboard: vi.fn(async () => "clipboard text"),
    getBrowserTab: vi.fn(async () => "browser text"),
  };
}

describe("createPlaceholderResolver", () => {
  it("keeps instructions separate from input", async () => {
    const sources = createSources();
    const resolver = createPlaceholderResolver(sources);

    const result = await resolver.resolve("Summarize this:\n{input}", {
      input: "The source",
      signal: new AbortController().signal,
    });

    expect(result).toEqual({
      parts: [
        { kind: "instruction", text: "Summarize this:\n" },
        { kind: "source", source: "input", text: "The source", truncated: false },
      ],
      truncatedSources: [],
    });
    expect(sources.getSelection).not.toHaveBeenCalled();
    expect(sources.getClipboard).not.toHaveBeenCalled();
    expect(sources.getBrowserTab).not.toHaveBeenCalled();
  });

  it("resolves only used sources and reads repeated sources once", async () => {
    const sources = createSources();
    const resolver = createPlaceholderResolver(sources);

    const result = await resolver.resolve("{selection}\nAgain: {selection}\n{clipboard}", {
      signal: new AbortController().signal,
    });

    expect(result.parts).toEqual([
      { kind: "source", source: "selection", text: "selected text", truncated: false },
      { kind: "instruction", text: "\nAgain: " },
      { kind: "source", source: "selection", text: "selected text", truncated: false },
      { kind: "instruction", text: "\n" },
      { kind: "source", source: "clipboard", text: "clipboard text", truncated: false },
    ]);
    expect(sources.getSelection).toHaveBeenCalledOnce();
    expect(sources.getClipboard).toHaveBeenCalledOnce();
    expect(sources.getBrowserTab).not.toHaveBeenCalled();
  });

  it("leaves unknown braces and JSON unchanged", async () => {
    const resolver = createPlaceholderResolver(createSources());
    const template = 'Return {unknown} and {"answer": true}.';

    const result = await resolver.resolve(template, { signal: new AbortController().signal });

    expect(result.parts).toEqual([{ kind: "instruction", text: template }]);
  });

  it("shortens long sources while preserving their start and end", async () => {
    const resolver = createPlaceholderResolver(createSources(), { maximumSourceCharacters: 12 });

    const result = await resolver.resolve("Read {input}", {
      input: "abcdefghijklmnop",
      signal: new AbortController().signal,
    });

    expect(result.parts).toEqual([
      { kind: "instruction", text: "Read " },
      { kind: "source", source: "input", text: "abcde\n…\nmnop", truncated: true },
    ]);
    expect(result.truncatedSources).toEqual(["input"]);
  });

  it("rejects blank input and an instruction-only prompt over the hard limit", async () => {
    const resolver = createPlaceholderResolver(createSources(), { maximumPromptCharacters: 10 });

    await expect(
      resolver.resolve("{input}", { input: "  ", signal: new AbortController().signal }),
    ).rejects.toMatchObject({ code: "missing-input" });
    await expect(
      resolver.resolve("12345678901", { signal: new AbortController().signal }),
    ).rejects.toMatchObject({ code: "prompt-too-long" });
  });
});
