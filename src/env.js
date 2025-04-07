import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

// IMPORTANT: To Load the env use (vercel env pull .env) / our db needs the .env not .env.local

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    // VERCEL_URL: z.string().url(),

    // Database variables
    DB_MAIN_PGUSER: z.string(),
    DB_MAIN_PGPASSWORD: z.string().startsWith("npg_"),
    DB_OWNER_PGUSER: z.string(),
    DB_OWNER_PGPASSWORD: z.string().startsWith("npg_"),
    DB_PGDATABASE: z.string(),
    DB_WRITE_PGHOST: z.string().endsWith(".neon.tech"),
    DB_READ1_PGHOST: z.string().endsWith(".neon.tech"),
    DB_READ2_PGHOST: z.string().endsWith(".neon.tech"),
  },
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    // VERCEL_URL: process.env.VERCEL_URL,
    // NEXT_PUBLIC_CLIENTVAR: process.env.NEXT_PUBLIC_CLIENTVAR,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Database environment variables
    DB_MAIN_PGUSER: process.env.DB_MAIN_PGUSER,
    DB_MAIN_PGPASSWORD: process.env.DB_MAIN_PGPASSWORD,
    DB_OWNER_PGUSER: process.env.DB_OWNER_PGUSER,
    DB_OWNER_PGPASSWORD: process.env.DB_OWNER_PGPASSWORD,
    DB_PGDATABASE: process.env.DB_PGDATABASE,
    DB_WRITE_PGHOST: process.env.DB_WRITE_PGHOST,
    DB_READ1_PGHOST: process.env.DB_READ1_PGHOST,
    DB_READ2_PGHOST: process.env.DB_READ2_PGHOST,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
