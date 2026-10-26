import { redirect } from "next/navigation";

export default async function PoliciesRedirect({
  searchParams,
}: {
  searchParams?: Promise<{ track?: string; sort?: string }> | { track?: string; sort?: string };
}) {
  const params = searchParams ? await searchParams : {};
  const query = new URLSearchParams();
  if (typeof params.track === "string" && params.track) query.set("track", params.track);
  if (typeof params.sort === "string" && params.sort) query.set("sort", params.sort);
  const text = query.toString();
  redirect(text ? `/?${text}` : "/");
}
