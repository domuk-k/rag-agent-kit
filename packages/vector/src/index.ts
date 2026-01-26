// @repo/vector - SQLite hybrid search (FTS5 + sqlite-vec)

export { getDb, EMBEDDING_DIMENSION } from './client';
export { getEmbedding, getEmbeddings } from './embeddings';
export { searchFaq, formatSearchResults, type SearchOptions } from './search';
export { upsertFaqItems, upsertSingleFaqVector } from './upsert';
export { deleteFaqFromVector, deleteFaqsFromVector, resetCollection } from './delete';
