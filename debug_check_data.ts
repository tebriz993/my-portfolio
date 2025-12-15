import dotenv from 'dotenv';
dotenv.config();

import pg from 'pg';
const { Pool } = pg;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function cleanup() {
    try {
        const client = await pool.connect();
        await client.query("DELETE FROM game_scores WHERE player_name = 'TestBot'");
        console.log("Cleanup complete.");
        client.release();
        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

cleanup();
