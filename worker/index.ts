import handler from "vinext/server/app-router-entry";
import { recordCronPlaceholder } from "../lib/cron";

type WorkerEnv = Env & {
  DB: D1Database;
};

export default {
  fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext) {
    return handler.fetch(request, env, ctx);
  },
  async scheduled(controller: ScheduledController, env: WorkerEnv, ctx: ExecutionContext) {
    ctx.waitUntil(
      recordCronPlaceholder(env.DB, controller.cron).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "cron failed";
        console.log(JSON.stringify({ event: "cron_placeholder_error", cron: controller.cron, message }));
      }),
    );
  },
};
