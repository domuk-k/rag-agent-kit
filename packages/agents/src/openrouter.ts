// OpenRouter configuration via environment variables
// OPENAI_API_KEY and OPENAI_BASE_URL are set in .env for @openai/agents SDK compatibility

export const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash-preview-05-20';

// Note: @openai/agents SDK automatically uses OPENAI_API_KEY and OPENAI_BASE_URL
// No need to manually configure client
