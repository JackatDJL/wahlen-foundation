import posthog from "posthog-js";
import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";

export async function GET() {
  await auth.protect();

  const user = await currentUser();
  if (!user) {
    return redirect("/");
  }

  posthog.identify(user.id, {
    email: user.emailAddresses[0]?.emailAddress,
    firstName: user.firstName,
    lastName: user.lastName,

    username: user.username,
  });
  return redirect("/");
}
