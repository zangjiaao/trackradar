import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";

class Statement {
  constructor(readonly db: DatabaseSync, readonly sql: string, readonly params: unknown[] = []) {}
  bind(...params: unknown[]) { return new Statement(this.db, this.sql, params); }
  async first<T>() { return this.db.prepare(this.sql).get(...this.params as never[]) as T ?? null; }
  async all<T>() { return { results: this.db.prepare(this.sql).all(...this.params as never[]) as T[] }; }
  async run() {
    const result = this.db.prepare(this.sql).run(...this.params as never[]);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
}

export function migratedDatabase(beforeOpcMigration?: (sqlite: DatabaseSync) => void) {
  const sqlite = new DatabaseSync(":memory:");
  const dir = new URL("../../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((name) => name.endsWith(".sql")).sort()) {
    if (name === "0022_opc_cases.sql") beforeOpcMigration?.(sqlite);
    sqlite.exec(readFileSync(new URL(name, dir), "utf8"));
  }
  const database = {
    prepare(sql: string) { return new Statement(sqlite, sql); },
    async batch(statements: Statement[]) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  } as unknown as D1Database;
  return { sqlite, database };
}
