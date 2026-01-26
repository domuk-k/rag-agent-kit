// OpenAI Embedding API (text-embedding-3-small for cost efficiency)
const OPENAI_API_KEY = process.env.OPENAI_EMBEDDING_API_KEY || process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = process.env.OPENAI_EMBEDDING_BASE_URL || 'https://api.openai.com/v1';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';

import { EMBEDDING_DIMENSION } from '@repo/db';

interface EmbeddingResponse {
  data: { embedding: number[]; index: number }[];
  usage: { prompt_tokens: number; total_tokens: number };
}

export async function getEmbedding(text: string): Promise<number[]> {
  const embeddings = await getEmbeddings([text]);
  return embeddings[0];
}

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY or OPENAI_EMBEDDING_API_KEY is required for embeddings');
  }

  console.log(`[Embeddings] Generating embeddings for ${texts.length} texts (${EMBEDDING_MODEL}, dim=${EMBEDDING_DIMENSION})...`);

  const response = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSION,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI embedding failed: ${response.status} ${text}`);
  }

  const data: EmbeddingResponse = await response.json();

  // Sort by index to maintain order
  const sorted = data.data.sort((a, b) => a.index - b.index);
  const embeddings = sorted.map((item) => item.embedding);

  console.log(`[Embeddings] Generated ${embeddings.length} embeddings (${data.usage.total_tokens} tokens)`);

  return embeddings;
}
