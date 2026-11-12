import { getDb } from "@/lib/db";
import { radarPost } from "@/lib/radar-http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return radarPost(getDb(), "lead", request);
}
