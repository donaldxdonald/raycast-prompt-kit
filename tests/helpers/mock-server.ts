import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

type Server = ReturnType<typeof createServer>;

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

export function createMockServerPool() {
  const servers: Server[] = [];

  return {
    async listen(handler: (request: IncomingMessage, response: ServerResponse) => void) {
      const server = createServer(handler);
      servers.push(server);
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Mock server did not provide a port");
      }
      return {
        baseURL: `http://127.0.0.1:${address.port}/v1`,
        async close() {
          const index = servers.indexOf(server);
          if (index !== -1) {
            servers.splice(index, 1);
          }
          await closeServer(server);
        },
      };
    },
    async closeAll() {
      await Promise.all(servers.splice(0).map(closeServer));
    },
  };
}
