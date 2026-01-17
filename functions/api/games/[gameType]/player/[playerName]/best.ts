import { drizzle } from "drizzle-orm/d1";
import { gameScores } from "../../../../../../shared/schema";
import { eq, desc, asc, and } from "drizzle-orm";


export const onRequestGet: PagesFunction<{ DB: D1Database }> = async (context) => {
    try {
        const { env, params } = context;
        const db = drizzle(env.DB);
        const gameType = params.gameType as string;
        const playerName = params.playerName as string;

        let orderBy;
        if (gameType === "memory") {
            orderBy = asc(gameScores.timeInSeconds);
        } else {
            orderBy = desc(gameScores.score);
        }

        const scores = await db
            .select()
            .from(gameScores)
            .where(and(
                eq(gameScores.gameType, gameType),
                eq(gameScores.playerName, playerName)
            ))
            .orderBy(orderBy)
            .limit(1);

        return new Response(JSON.stringify(scores[0] || null), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: "Failed to fetch player best score",
            details: String(error)
        }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
};
