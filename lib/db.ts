import { env } from "cloudflare:workers";

export class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseError";
  }
}

export function getDb(): D1Database {
  const database = env.DB;
  if (!database) {
    throw new DatabaseError("未绑定 D1 数据库 DB。请确认 wrangler.jsonc，并先执行 npm run db:migrate。");
  }
  return database;
}

export function readModelEnv(): { apiKey: string; baseURL?: string; model: string } | null {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const baseURL = env.OPENAI_BASE_URL?.trim();
  const model = env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  return { apiKey, baseURL: baseURL || undefined, model };
}
