const KEY_LIMIT = 10;

export type AgentKeyPublic = {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
};

export async function listAgentKeys(database: D1Database): Promise<AgentKeyPublic[]> {
  const { results } = await database
    .prepare(
      `SELECT id, name, token_prefix AS prefix, created_at, last_used_at
       FROM agent_keys
       WHERE revoked_at IS NULL
       ORDER BY created_at DESC`,
    )
    .all<AgentKeyPublic>();
  return results;
}

export async function createAgentKey(database: D1Database, nameInput: unknown) {
  const name = keyName(nameInput);
  const active = await database.prepare("SELECT COUNT(*) AS count FROM agent_keys WHERE revoked_at IS NULL").first<{ count: number }>();
  if ((active?.count ?? 0) >= KEY_LIMIT) throw new Error("钥匙太多。先作废不用的。");
  const key = newToken();
  const row: AgentKeyPublic = {
    id: crypto.randomUUID(),
    name,
    prefix: key.slice(0, 12),
    created_at: new Date().toISOString(),
    last_used_at: null,
  };
  await database
    .prepare("INSERT INTO agent_keys (id, name, token_hash, token_prefix, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(row.id, row.name, await tokenHash(key), row.prefix, row.created_at)
    .run();
  return { ...row, key };
}

export async function revokeAgentKey(database: D1Database, id: unknown) {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("没有这把钥匙。");
  const existing = await database.prepare("SELECT id FROM agent_keys WHERE id = ? AND revoked_at IS NULL").bind(id).first<{ id: string }>();
  if (!existing) throw new Error("没有这把钥匙。");
  await database.prepare("UPDATE agent_keys SET revoked_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
}

/** Null when the bearer key is valid. The raw key is not stored. */
export async function authorizeAgent(database: D1Database, request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/.exec(header);
  if (!match) return Response.json({ error: "需要 Agent API Key。" }, { status: 401 });
  const token = match[1] ?? "";
  if (!token.startsWith("trk_") || token.length > 200) return Response.json({ error: "Agent API Key 无效。" }, { status: 401 });
  const row = await database
    .prepare("SELECT id FROM agent_keys WHERE token_hash = ? AND revoked_at IS NULL")
    .bind(await tokenHash(token))
    .first<{ id: string }>();
  if (!row) return Response.json({ error: "Agent API Key 无效。" }, { status: 401 });
  await database.prepare("UPDATE agent_keys SET last_used_at = ? WHERE id = ?").bind(new Date().toISOString(), row.id).run();
  return null;
}

function keyName(input: unknown) {
  const name = typeof input === "string" ? input.trim() : "";
  const value = name || "办公室";
  if ([...value].length > 40 || /[\u0000-\u001f]/.test(value)) throw new Error("名称太长。");
  return value;
}

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `trk_${btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")}`;
}

async function tokenHash(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
