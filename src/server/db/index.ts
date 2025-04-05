import { env } from "~/env";
import { withReplicas } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const primaryPool = new Pool({
  connectionString: `postgres://${env.DB_MAIN_PGUSER}:${env.DB_MAIN_PGPASSWORD}@${env.DB_MAIN_PGHOST}/${env.DB_PGDATABASE}?sslmode=require`,
  max: 10000,
});
const read1Pool = new Pool({
  connectionString: `postgres://${env.DB_READ1_PGUSER}:${env.DB_READ1_PGPASSWORD}@${env.DB_READ1_PGHOST}/${env.DB_PGDATABASE}?sslmode=require`,
  max: 10000,
});
const read2Pool = new Pool({
  connectionString: `postgres://${env.DB_READ2_PGUSER}:${env.DB_READ2_PGPASSWORD}@${env.DB_READ2_PGHOST}/${env.DB_PGDATABASE}?sslmode=require`,
  max: 10000,
});

const primary = drizzle(primaryPool);

const read1 = drizzle(read1Pool);
const read2 = drizzle(read2Pool);

export const db = withReplicas(primary, [read1, read2]);
