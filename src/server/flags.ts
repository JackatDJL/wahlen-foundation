import { auth } from "@clerk/nextjs/server";
import { dedupe, flag } from "flags/next";
import posthog from "posthog-js";

const identify = dedupe(() => {
  const user = auth();
  return user;
});

export const earlyAccessFlag = flag({
  key: "early-access",
  identify,
  defaultValue: false,
  decide() {
    return !!posthog.isFeatureEnabled("early-access");
  },
});
