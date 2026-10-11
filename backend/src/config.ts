import { z } from "zod";
export function validateEnvironment(raw: Record<string, unknown>) {
  const schema = z.object({
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    WEB_ORIGIN: z.string().default("http://localhost:3000"),
    MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
    GEMMA_PROVIDER: z.enum(["google", "openai-compatible"]).default("google"),
    GEMMA_BASE_URL: z
      .string()
      .url()
      .default("https://generativelanguage.googleapis.com/v1beta"),
    GEMMA_MODEL: z.string().default("gemma-4-26b-a4b-it"),
    GEMMA_API_KEY: z.string().optional(),
    ELEVENLABS_BASE_URL: z
      .string()
      .url()
      .default("https://api.elevenlabs.io/v1"),
    ELEVENLABS_API_KEY: z.string().optional(),
    ELEVENLABS_VOICE_ID: z.string().optional(),
    ELEVENLABS_MODEL: z.string().default("eleven_multilingual_v2"),
    SERPAPI_BASE_URL: z
      .string()
      .url()
      .default("https://serpapi.com/search.json"),
    SERPAPI_API_KEY: z.string().optional(),
  });
  return schema.parse(raw);
}
