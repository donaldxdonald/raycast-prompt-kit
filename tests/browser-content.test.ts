import { describe, expect, it, vi } from "vitest";

import { readBrowserContent } from "../src/lib/browser-content";

describe("readBrowserContent", () => {
  it("reads and trims Markdown only when Browser Companion is accessible", async () => {
    const getContent = vi.fn(async () => "  # Page\n  ");

    await expect(
      readBrowserContent(new AbortController().signal, { canAccess: () => true, getContent }),
    ).resolves.toBe("# Page");
    expect(getContent).toHaveBeenCalledWith({ format: "markdown" });
  });

  it("returns stable errors when the companion or content is unavailable", async () => {
    await expect(
      readBrowserContent(new AbortController().signal, {
        canAccess: () => false,
        getContent: vi.fn(async () => "unused"),
      }),
    ).rejects.toMatchObject({ code: "browser-unavailable" });

    await expect(
      readBrowserContent(new AbortController().signal, {
        canAccess: () => true,
        getContent: vi.fn(async () => "  "),
      }),
    ).rejects.toMatchObject({ code: "browser-empty" });
  });
});
