import { QdrantClient } from '@qdrant/js-client-rest';

export const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY, // Optional for cloud
  checkCompatibility: false, // Skip version check to avoid timeout issues
});

export const COLLECTION_NAME = process.env.QDRANT_COLLECTION || 'faq';
export const EMBEDDING_DIMENSION = 1536; // text-embedding-3-small
