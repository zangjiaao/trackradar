import { WorkerEntrypoint } from "cloudflare:workers";
import handler from "vinext/server/app-router-entry";
import skillClient from "../skill/agent/scripts/client.mjs?raw";
import skillInstalled from "../skill/agent/SKILL.md?raw";
import skillBootstrap from "../skill/skill.md?raw";
import { runScheduledTasks } from "../lib/cron";
import { DatabaseError } from "../lib/db";
import { radarBrief, radarLead } from "../lib/radar-read";

const SKILL_PAGES: Record<string, { body: string; type: string }> = {
  "/skill.md": { body: skillBootstrap, type: "text/markdown; charset=utf-8" },
  "/agent/SKILL.md": { body: skillInstalled, type: "text/markdown; charset=utf-8" },
  "/agent/scripts/client.mjs": { body: skillClient, type: "text/javascript; charset=utf-8" },
};

type WorkerEnv = Env & {
  DB: D1Database;
};

function databaseOf(env: WorkerEnv): D1Database {
  if (!env.DB) {
    throw new DatabaseError("未绑定 D1 数据库 DB。请确认 wrangler.jsonc，并先执行 npm run db:migrate。");
  }
  return env.DB;
}

/** 同账号 Worker 用 service binding 调用。公网请求仍走下面的 fetch。 */
export class RadarApi extends WorkerEntrypoint<WorkerEnv> {
  async brief(input?: unknown) {
    return radarBrief(databaseOf(this.env), input);
  }

  async lead(input?: unknown) {
    return radarLead(databaseOf(this.env), input);
  }
}

export default {
  fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (request.method === "GET") {
      const page = SKILL_PAGES[url.pathname];
      if (page) {
        return new Response(page.body, {
          headers: {
            "content-type": page.type,
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
          },
        });
      }
    }
    return handler.fetch(request, env, ctx);
  },
  async scheduled(controller: ScheduledController, env: WorkerEnv, ctx: ExecutionContext) {
    ctx.waitUntil(
      runScheduledTasks(env.DB, controller.cron).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "cron failed";
        console.log(JSON.stringify({ event: "cron_task_error", cron: controller.cron, message }));
      }),
    );
  },
};
