import { qdrant, COLLECTION_NAME, EMBEDDING_DIMENSION } from '../client';

async function main() {
  console.log(`[Setup] Creating collection: ${COLLECTION_NAME}`);

  // Check if collection exists
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some((c) => c.name === COLLECTION_NAME);

  if (exists) {
    console.log(`[Setup] Collection "${COLLECTION_NAME}" already exists`);

    const info = await qdrant.getCollection(COLLECTION_NAME);
    console.log(`[Setup] Points count: ${info.points_count}`);
    return;
  }

  // Create collection
  await qdrant.createCollection(COLLECTION_NAME, {
    vectors: {
      size: EMBEDDING_DIMENSION,
      distance: 'Cosine',
    },
    optimizers_config: {
      indexing_threshold: 20000,
    },
    hnsw_config: {
      m: 16,
      ef_construct: 100,
    },
  });

  console.log(`[Setup] Collection created successfully!`);
  console.log(`[Setup] Vector size: ${EMBEDDING_DIMENSION}, Distance: Cosine`);
}

main().catch(console.error);
