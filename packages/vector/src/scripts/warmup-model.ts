/**
 * Docker 빌드 시 ONNX 임베딩 모델을 사전 다운로드하는 warmup 스크립트.
 * 컨테이너 재시작마다 ~113MB 모델을 다운로드하는 것을 방지.
 */
import { pipeline } from '@huggingface/transformers';

await pipeline('feature-extraction', 'Xenova/multilingual-e5-small', { dtype: 'q8' });
console.log('[Docker] ONNX model cached');
