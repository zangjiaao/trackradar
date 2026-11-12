import { authorizeAgent } from "@/lib/agent-key";
import { getDb } from "@/lib/db";
import { radarPost } from "@/lib/radar-http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const database = getDb();
  const denied = await authorizeAgent(database, request);
  if (denied) return denied;
  return radarPost(database, "brief", request);
}
