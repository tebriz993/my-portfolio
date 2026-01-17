import { drizzle } from "drizzle-orm/d1";
import { gameScores } from "../../../../shared/schema";
import { eq, desc, asc } from "drizzle-orm";

export const onRequestGet: PagesFunction<{ DB: D1Database }> = async (context) => {
    try {
        const { request, env, params } = context;
        const db = drizzle(env.DB);
        const gameType = params.gameType as string;

        // Parse query params
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get("limit") || "10");

        let orderBy;
        if (gameType === "memory" || gameType === "sudoku") {
            // For memory and sudoku, lower time is better
            orderBy = asc(gameScores.timeInSeconds);
        } else if (gameType === "reaction-time") {
            // For reaction time, lower score (ms) is better
            orderBy = asc(gameScores.score);
        } else {
            // For other games, higher score is better
            orderBy = desc(gameScores.score);
        }

        const scores = await db
            .select()
            .from(gameScores)
            .where(eq(gameScores.gameType, gameType))
            .orderBy(orderBy)
            .limit(limit);

        return new Response(JSON.stringify(scores), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: "Failed to fetch scores",
            details: String(error)
        }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
};
