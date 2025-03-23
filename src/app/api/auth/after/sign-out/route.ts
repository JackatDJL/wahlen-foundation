import posthog from "posthog-js";
import { redirect } from "next/navigation";

export async function GET() {
  posthog.reset();
  return redirect("/");
}
