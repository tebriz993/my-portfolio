import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

const { Pool } = pg;

// Connection logging
if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL must be set. Did you forget to provision a database?");
}

if (process.env.NODE_ENV !== "production") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

console.log(`Connecting to DB: ${process.env.DATABASE_URL?.split('@')[1] || 'Unknown Host'}`);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://user:pass@localhost:5432/db",
  ssl: process.env.NODE_ENV === "production" ? {
    rejectUnauthorized: false,
    checkServerIdentity: () => undefined
  } : undefined
});
export const db = drizzle({ client: pool, schema });

// Test connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully at:', res.rows[0].now);
  }
});