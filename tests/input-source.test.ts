import { describe, expect, it, vi } from "vitest";

import { resolveTextInput } from "../src/lib/input-source";

describe("resolveTextInput", () => {
  it("uses a non-blank command argument before selected text", async () => {
    const getSelection = vi.fn(async () => "selected text");

    await expect(resolveTextInput("  argument text  ", getSelection)).resolves.toEqual({
      kind: "ready",
      text: "argument text",
    });
    expect(getSelection).not.toHaveBeenCalled();
  });

  it("falls back to selected text", async () => {
    await expect(resolveTextInput(" ", async () => "  selected text  ")).resolves.toEqual({
      kind: "ready",
      text: "selected text",
    });
  });

  it("requests a form when selected text is blank or unavailable", async () => {
    await expect(resolveTextInput(undefined, async () => "  ")).resolves.toEqual({ kind: "form" });
    await expect(
      resolveTextInput(undefined, async () => {
        throw new Error("No selection");
      }),
    ).resolves.toEqual({ kind: "form" });
  });
});
