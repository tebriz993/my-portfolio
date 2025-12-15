import pg from 'pg';
const { Pool } = pg;

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
}

console.log("Testing connection with ssl: { rejectUnauthorized: false }");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Connection FAILED:', err);
        process.exit(1);
    }
    console.log('Connection SUCCESS:', res.rows[0]);
    process.exit(0);
});
