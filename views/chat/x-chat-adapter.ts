import type { AIChatMessage } from '#/plugins/ai/api';

import type { SSEOutput } from '@antdv-next/x-sdk/x-stream';

import XStream from '@antdv-next/x-sdk/x-stream';

import { toAIChatMessage } from './data';

export interface AIChatStreamAdapterOptions {
  onMessage: (message: AIChatMessage) => void;
}

function normalizeSSEOutput(output: SSEOutput) {
  const eventName =
    typeof output.event === 'string' ? output.event.trim() : undefined;
  const rawData = output.data;

  if (!eventName || typeof rawData !== 'string' || !rawData.trim()) {
    return null;
  }

  try {
    return toAIChatMessage({
      data: JSON.parse(rawData),
      event: eventName,
    } as Parameters<typeof toAIChatMessage>[0]);
  } catch {
    return null;
  }
}

export function createAIChatStreamAdapter(
  options: AIChatStreamAdapterOptions,
) {
  const transport = new TransformStream<Uint8Array, Uint8Array>();
  const writer = transport.writable.getWriter();
  const encoder = new TextEncoder();

  let closed = false;
  let writeTask = Promise.resolve();

  const readerTask = (async () => {
    const stream = XStream({ readableStream: transport.readable });

    for await (const output of stream) {
      const message = normalizeSSEOutput(output);
      if (message) {
        options.onMessage(message);
      }
    }
  })();

  return {
    consumeChunk(chunk: string) {
      if (closed || !chunk) {
        return;
      }

      writeTask = writeTask.then(() => writer.write(encoder.encode(chunk)));
    },
    async flush() {
      if (closed) {
        await readerTask;
        return;
      }

      closed = true;
      await writeTask;
      await writer.close();
      await readerTask;
    },
    async cancel() {
      if (closed) {
        return;
      }

      closed = true;
      await writeTask.catch(() => undefined);
      await writer.abort().catch(() => undefined);
      await readerTask.catch(() => undefined);
    },
  };
}
