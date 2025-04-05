import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

// IMPORTANT: To Load the env use (vercel env pull .env) / our db needs the .env not .env.local

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    // VERCEL_URL: z.string().url(),

    // New Database variables
    DB_OWNER_PGHOST: z.string(),
    DB_OWNER_PGPASSWORD: z.string(),
    DB_OWNER_PGUSER: z.string(),
    DB_MAIN_PGHOST: z.string(),
    DB_MAIN_PGPASSWORD: z.string(),
    DB_MAIN_PGUSER: z.string(),
    DB_PGDATABASE: z.string(),
    DB_READ1_PGHOST: z.string(),
    DB_READ1_PGPASSWORD: z.string(),
    DB_READ1_PGUSER: z.string(),
    DB_READ2_PGHOST: z.string(),
    DB_READ2_PGPASSWORD: z.string(),
    DB_READ2_PGUSER: z.string(),
  },
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string(),

    NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL: z.string(),
    NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL: z.string(),
    NEXT_PUBLIC_CLERK_SIGN_OUT_FORCE_REDIRECT_URL: z.string(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    // VERCEL_URL: process.env.VERCEL_URL,
    // NEXT_PUBLIC_CLIENTVAR: process.env.NEXT_PUBLIC_CLIENTVAR,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,

    NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL:
      process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL,
    NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL:
      process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL,
    NEXT_PUBLIC_CLERK_SIGN_OUT_FORCE_REDIRECT_URL:
      process.env.NEXT_PUBLIC_CLERK_SIGN_OUT_FORCE_REDIRECT_URL,
    // New Database environment variables
    DB_OWNER_PGHOST: process.env.DB_OWNER_PGHOST,
    DB_OWNER_PGPASSWORD: process.env.DB_OWNER_PGPASSWORD,
    DB_OWNER_PGUSER: process.env.DB_OWNER_PGUSER,
    DB_MAIN_PGHOST: process.env.DB_MAIN_PGHOST,
    DB_MAIN_PGPASSWORD: process.env.DB_MAIN_PGPASSWORD,
    DB_MAIN_PGUSER: process.env.DB_MAIN_PGUSER,
    DB_PGDATABASE: process.env.DB_PGDATABASE,
    DB_READ1_PGHOST: process.env.DB_READ1_PGHOST,
    DB_READ1_PGPASSWORD: process.env.DB_READ1_PGPASSWORD,
    DB_READ1_PGUSER: process.env.DB_READ1_PGUSER,
    DB_READ2_PGHOST: process.env.DB_READ2_PGHOST,
    DB_READ2_PGPASSWORD: process.env.DB_READ2_PGPASSWORD,
    DB_READ2_PGUSER: process.env.DB_READ2_PGUSER,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
