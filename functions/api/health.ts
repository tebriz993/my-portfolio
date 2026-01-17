import { drizzle } from "drizzle-orm/d1";
import { sql } from "drizzle-orm";

export const onRequestGet: PagesFunction<{ DB: D1Database }> = async (context) => {
    try {
        const db = drizzle(context.env.DB);
        // Simple query to check DB connection
        const result = await db.run(sql`SELECT 1`);

        return new Response(JSON.stringify({
            status: "ok",
            database: "connected",
            timestamp: new Date().toISOString()
        }), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            status: "error",
            error: String(error)
        }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
};
