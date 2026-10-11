import { config } from "dotenv";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { resolve } from "node:path";
import * as schema from "./schema.js";

config({ path: resolve(process.cwd(), "../../.env") });

type Database = NodePgDatabase<typeof schema>;

let database: Database | undefined;

export function getDatabase(): Database {
  if (database) return database;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error("Set DATABASE_URL in the root .env file.");

  database = drizzle(new Pool({ connectionString }), { schema });
  return database;
}
