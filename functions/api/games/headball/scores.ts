import { drizzle } from "drizzle-orm/d1";
import { gameScores } from "../../../../shared/schema";
import { eq, desc } from "drizzle-orm";


export const onRequestGet: PagesFunction<{ DB: D1Database }> = async (context) => {
    try {
        const { request, env } = context;
        const db = drizzle(env.DB);

        // Parse query params
        const url = new URL(request.url);
        const limitParams = url.searchParams.get("limit");
        const limit = limitParams ? parseInt(limitParams) : 100; // Default 100 for headball

        const scores = await db
            .select({
                id: gameScores.id,
                playerName: gameScores.playerName,
                score: gameScores.score,
                timeInSeconds: gameScores.timeInSeconds,
                createdAt: gameScores.createdAt,
            })
            .from(gameScores)
            .where(eq(gameScores.gameType, 'headball'))
            .orderBy(desc(gameScores.score))
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

export const onRequestPost: PagesFunction<{ DB: D1Database }> = async (context) => {
    try {
        const { request, env } = context;
        const db = drizzle(env.DB);
        const body: any = await request.json();
        const { playerName, score, timeInSeconds } = body;

        if (!playerName || typeof score !== 'number' || typeof timeInSeconds !== 'number') {
            return new Response(JSON.stringify({ error: "Invalid score data" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        const result = await db
            .insert(gameScores)
            .values({
                playerName,
                gameType: 'headball',
                score,
                timeInSeconds,
            })
            .returning();

        return new Response(JSON.stringify(result[0]), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: "Failed to save score",
            details: String(error)
        }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
};
