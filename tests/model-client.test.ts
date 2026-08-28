import type { IncomingMessage } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import { createMockServerPool } from "./helpers/mock-server";
import { streamModelResponse, type ModelConfig } from "../src/lib/model-client";

const validConfig: ModelConfig = {
  apiKey: "fake-key",
  baseURL: "https://api.openai.com/v1",
  model: "test-model",
  maximumSourceCharacters: 20_000,
};

const servers = createMockServerPool();

afterEach(async () => {
  await servers.closeAll();
});

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

describe("streamModelResponse", () => {
  it("sends a Chat Completions request and forwards stream deltas", async () => {
    let receivedRequest: { path?: string; authorization?: string; body?: unknown } = {};
    const { baseURL } = await servers.listen(async (request, response) => {
      receivedRequest = {
        path: request.url,
        authorization: request.headers.authorization,
        body: JSON.parse(await readBody(request)),
      };
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.write(
        'data: {"id":"one","object":"chat.completion.chunk","created":0,"model":"test-model","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
      );
      response.write(
        'data: {"id":"one","object":"chat.completion.chunk","created":0,"model":"test-model","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":"stop"}]}\n\n',
      );
      response.end("data: [DONE]\n\n");
    });
    const deltas: string[] = [];
    const messages = [
      { role: "system" as const, content: "System" },
      { role: "user" as const, content: "Question" },
    ];

    const text = await streamModelResponse({
      config: { ...validConfig, baseURL, reasoningEffort: "high" },
      messages,
      signal: new AbortController().signal,
      onDelta: (delta) => deltas.push(delta),
    });

    expect(text).toBe("Hello world");
    expect(deltas).toEqual(["Hello", " world"]);
    expect(receivedRequest).toEqual({
      path: "/v1/chat/completions",
      authorization: "Bearer fake-key",
      body: expect.objectContaining({ model: "test-model", messages, reasoning_effort: "high", stream: true }),
    });
    expect(receivedRequest.body).not.toHaveProperty("tools");
  });

  it("sends the local token as a bearer credential", async () => {
    let authorization: string | undefined;
    let body: Record<string, unknown> = {};
    const { baseURL } = await servers.listen(async (request, response) => {
      authorization = request.headers.authorization;
      body = JSON.parse(await readBody(request));
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.end("data: [DONE]\n\n");
    });

    await streamModelResponse({
      config: { ...validConfig, apiKey: "local", baseURL },
      messages: [{ role: "user", content: "Question" }],
      signal: new AbortController().signal,
      onDelta: () => undefined,
    });

    expect(authorization).toBe("Bearer local");
    expect(body).not.toHaveProperty("reasoning_effort");
  });

  it("accepts CRLF-delimited SSE", async () => {
    const { baseURL } = await servers.listen((_request, response) => {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.write(
        'data: {"id":"one","object":"chat.completion.chunk","created":0,"model":"test-model","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":"stop"}]}\r\n\r\n',
      );
      response.end("data: [DONE]\r\n\r\n");
    });

    await expect(
      streamModelResponse({
        config: { ...validConfig, baseURL },
        messages: [{ role: "user", content: "Question" }],
        signal: new AbortController().signal,
        onDelta: () => undefined,
      }),
    ).resolves.toBe("Hello");
  });

  it.each([
    [401, { error: { message: "bad key" } }, "authentication"],
    [404, { error: { message: "model not found" } }, "model-not-found"],
    [429, { error: { message: "slow down" } }, "rate-limited"],
    [400, { error: { message: "maximum context length exceeded", code: "context_length_exceeded" } }, "context-length"],
    [500, { error: { message: "provider exploded" } }, "provider"],
  ])("maps HTTP %i to %s", async (status, body, code) => {
    const { baseURL } = await servers.listen((_request, response) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    });

    await expect(
      streamModelResponse({
        config: { ...validConfig, baseURL },
        messages: [{ role: "user", content: "Question" }],
        signal: new AbortController().signal,
        onDelta: () => undefined,
      }),
    ).rejects.toMatchObject({ code });
  });

  it("maps connection failures to a stable network error", async () => {
    const { baseURL, close } = await servers.listen(() => undefined);
    await close();

    await expect(
      streamModelResponse({
        config: { ...validConfig, baseURL },
        messages: [{ role: "user", content: "Question" }],
        signal: new AbortController().signal,
        onDelta: () => undefined,
      }),
    ).rejects.toMatchObject({ code: "network" });
  });

  it("maps malformed streams to a stable provider error", async () => {
    const { baseURL } = await servers.listen((_request, response) => {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.end("data: this-is-not-json\n\n");
    });

    await expect(
      streamModelResponse({
        config: { ...validConfig, baseURL },
        messages: [{ role: "user", content: "Question" }],
        signal: new AbortController().signal,
        onDelta: () => undefined,
      }),
    ).rejects.toMatchObject({ code: "provider" });
  });

  it("stops an active request when its signal is aborted", async () => {
    const controller = new AbortController();
    const { baseURL } = await servers.listen((_request, response) => {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.flushHeaders();
      controller.abort();
    });

    await expect(
      streamModelResponse({
        config: { ...validConfig, baseURL },
        messages: [{ role: "user", content: "Question" }],
        signal: controller.signal,
        onDelta: () => undefined,
      }),
    ).rejects.toMatchObject({ code: "cancelled" });
  });
});
