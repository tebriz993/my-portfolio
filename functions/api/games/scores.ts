import { drizzle } from "drizzle-orm/d1";
import { insertGameScoreSchema, gameScores } from "../../../shared/schema";

export const onRequestPost: PagesFunction<{ DB: D1Database }> = async (context) => {
    try {
        const { request, env } = context;
        const db = drizzle(env.DB);
        const body = await request.json();

        // Use Zod schema from shared wrapper
        // Note: zod schema expects 'timeInSeconds' as number, etc.
        const scoreData = insertGameScoreSchema.parse(body);

        const result = await db
            .insert(gameScores)
            .values(scoreData)
            .returning();

        return new Response(JSON.stringify(result[0]), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (error: any) {
        if (error.issues) { // Zod error
            return new Response(JSON.stringify({
                error: "Invalid score data",
                details: error.issues
            }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({
            error: "Failed to save score",
            details: String(error)
        }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
};
