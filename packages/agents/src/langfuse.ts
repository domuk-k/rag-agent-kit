import { Langfuse } from 'langfuse';

// Langfuse 클라이언트 초기화
// 환경변수: LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST (optional)
export const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY || '',
  secretKey: process.env.LANGFUSE_SECRET_KEY || '',
  baseUrl: process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
});

// 프롬프트 가져오기 (Langfuse에서 관리)
export async function getPrompt(name: string, version?: number) {
  try {
    const prompt = await langfuse.getPrompt(name, version);
    return prompt;
  } catch (error) {
    console.error(`[Langfuse] Failed to get prompt "${name}":`, error);
    return null;
  }
}

// 트레이스 생성
export function createTrace(options: {
  name: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}) {
  return langfuse.trace({
    name: options.name,
    userId: options.userId,
    sessionId: options.sessionId,
    metadata: options.metadata,
  });
}

// 종료 시 flush
export async function flushLangfuse() {
  await langfuse.flushAsync();
}

// 프로세스 종료 시 자동 flush
process.on('beforeExit', async () => {
  await flushLangfuse();
});
