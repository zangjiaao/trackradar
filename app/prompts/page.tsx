import { redirect } from "next/navigation";

export default function PromptsRedirect() {
  redirect("/settings#requirements");
}
