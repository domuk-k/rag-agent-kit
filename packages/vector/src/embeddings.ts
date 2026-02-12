/**
 * 로컬 임베딩 — Transformers.js + multilingual-e5-small (ONNX, int8)
 *
 * Bun 프로세스 내에서 직접 실행. 별도 서비스(Ollama 등) 불필요.
 * 모델: 384차원, 113MB, ~15-30ms/쿼리 (CPU)
 *
 * e5 계열 모델은 prefix가 필요:
 *   - 검색 쿼리: "query: {text}"
 *   - 문서/패시지: "passage: {text}"
 */

import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

const MODEL_ID = 'Xenova/multilingual-e5-small';
export const EMBEDDING_DIMENSIONS = 384;

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    console.log(`[Embedding] Loading model: ${MODEL_ID} (first call only)...`);
    extractorPromise = pipeline('feature-extraction', MODEL_ID, {
      dtype: 'q8',
    }).then((ext) => {
      console.log(`[Embedding] Model loaded.`);
      return ext;
    });
  }
  return extractorPromise;
}

/** 검색 쿼리 → 384차원 벡터 */
export async function embedQuery(text: string): Promise<number[]> {
  const ext = await getExtractor();
  const output = await ext(`query: ${text}`, { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
}

/** 문서(FAQ question) 배치 → 384차원 벡터 배열 */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const ext = await getExtractor();
  const results: number[][] = [];

  for (const text of texts) {
    const output = await ext(`passage: ${text}`, { pooling: 'mean', normalize: true });
    results.push(Array.from(output.data as Float32Array));
  }

  return results;
}
