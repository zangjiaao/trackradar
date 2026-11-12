import { WorkerEntrypoint } from "cloudflare:workers";
import handler from "vinext/server/app-router-entry";
import { runScheduledTasks } from "../lib/cron";
import { DatabaseError } from "../lib/db";
import { radarBrief, radarLead } from "../lib/radar-read";

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
