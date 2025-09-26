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

export const devModeFlag = flag({
  key: "dev-mode",
  defaultValue: false,
  decide() {
    return process.env.NODE_ENV === "development";
  },
});

export const shortnameDevInterface = flag({
  key: "shortname",
  options: [
    {
      label: "Use x-short-overwrite Cookie",
      value: "@ovr/cookie",
    },
    {
      label: 'Tv: "Test"',
      value: "test",
    },
    {
      label: 'Tv: "SV"',
      value: "sv",
    },
    {
      label: 'Tv: "Your Club"',
      value: "club",
    },
    {
      label: 'Tv: "DJL Foundation"',
      value: "djl",
    },
    {
      label: "Not Found",
      value: "@ovr/not-found",
    },
  ],
  defaultValue: null,
  decide(): null | string {
    return null;
  },
});
