import crypto from "node:crypto";

function authHeader(publicKey, secretKey) {
  return `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString("base64")}`;
}

class NoopTrace {
  async update() {}
  async span() {
    return { end: async () => {} };
  }
  async generation() {
    return { end: async () => {} };
  }
}

export function createLangfuseClient(env) {
  const host = env.LANGFUSE_HOST || "https://cloud.langfuse.com";
  const publicKey = env.LANGFUSE_PUBLIC_KEY;
  const secretKey = env.LANGFUSE_SECRET_KEY;

  if (!publicKey || !secretKey) {
    return {
      enabled: false,
      async trace() {
        return new NoopTrace();
      },
    };
  }

  async function ingest(batch) {
    try {
      await fetch(`${host}/api/public/ingestion`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: authHeader(publicKey, secretKey),
        },
        body: JSON.stringify({ batch }),
      });
    } catch {
      // Observability should never break product flow.
    }
  }

  return {
    enabled: true,
    async trace({ name, input, metadata }) {
      const traceId = crypto.randomUUID();
      await ingest([
        {
          id: crypto.randomUUID(),
          type: "trace-create",
          timestamp: new Date().toISOString(),
          body: {
            id: traceId,
            name,
            input,
            metadata,
          },
        },
      ]);

      return {
        async update({ output, metadata: updateMetadata }) {
          await ingest([
            {
              id: crypto.randomUUID(),
              type: "trace-update",
              timestamp: new Date().toISOString(),
              body: {
                id: traceId,
                output,
                metadata: updateMetadata,
              },
            },
          ]);
        },
        async span({ name: spanName, input: spanInput }) {
          const spanId = crypto.randomUUID();
          await ingest([
            {
              id: crypto.randomUUID(),
              type: "span-create",
              timestamp: new Date().toISOString(),
              body: {
                id: spanId,
                traceId,
                name: spanName,
                input: spanInput,
                startTime: new Date().toISOString(),
              },
            },
          ]);

          return {
            async end({ output, level = "DEFAULT", statusMessage, metadata: spanMetadata }) {
              await ingest([
                {
                  id: crypto.randomUUID(),
                  type: "span-update",
                  timestamp: new Date().toISOString(),
                  body: {
                    id: spanId,
                    traceId,
                    output,
                    level,
                    statusMessage,
                    metadata: spanMetadata,
                    endTime: new Date().toISOString(),
                  },
                },
              ]);
            },
          };
        },
        async generation({ name: generationName, input: generationInput, model }) {
          const generationId = crypto.randomUUID();
          await ingest([
            {
              id: crypto.randomUUID(),
              type: "generation-create",
              timestamp: new Date().toISOString(),
              body: {
                id: generationId,
                traceId,
                name: generationName,
                input: generationInput,
                model,
                startTime: new Date().toISOString(),
              },
            },
          ]);

          return {
            async end({ output, metadata: generationMetadata }) {
              await ingest([
                {
                  id: crypto.randomUUID(),
                  type: "generation-update",
                  timestamp: new Date().toISOString(),
                  body: {
                    id: generationId,
                    traceId,
                    output,
                    metadata: generationMetadata,
                    endTime: new Date().toISOString(),
                  },
                },
              ]);
            },
          };
        },
      };
    },
  };
}
