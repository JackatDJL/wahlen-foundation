import { type Config } from "drizzle-kit";

import { env } from "~/env";

export default {
  schema: "./src/server/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: `postgres://${env.DB_OWNER_PGUSER}:${env.DB_OWNER_PGPASSWORD}@${env.DB_OWNER_PGHOST}/${env.DB_PGDATABASE}?sslmode=require`,
  },
} satisfies Config;
