import "server-only";

// OpenRouter through Mastra's model router, which reads OPENROUTER_API_KEY itself.
// Its own module so tests can swap in a mock model.
export const lissieModel =
  `openrouter/${process.env.OPENROUTER_MODEL || "z-ai/glm-5.3-flash"}` as const;
