// Vercel AI SDK Data Stream Protocol helpers
// Format: https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol

export function formatTextChunk(text: string): string {
  return `0:${JSON.stringify(text)}\n`;
}

export function formatFinishMessage(reason: string = 'stop'): string {
  return `d:${JSON.stringify({ finishReason: reason })}\n`;
}

export function formatErrorMessage(error: string): string {
  return `3:${JSON.stringify(error)}\n`;
}

export function formatDataMessage(data: unknown): string {
  return `2:${JSON.stringify([data])}\n`;
}

// Helper to stream text in chunks
export function* chunkText(text: string, chunkSize: number = 20): Generator<string> {
  for (let i = 0; i < text.length; i += chunkSize) {
    yield text.slice(i, i + chunkSize);
  }
}
