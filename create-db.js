import pg from 'pg';
const { Client } = pg;

// Connect to default postgres database to create our database
const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '12qw',
    database: 'postgres', // connect to default database
});

async function createDatabase() {
    try {
        await client.connect();
        console.log('✅ Connected to PostgreSQL');

        // Check if database exists
        const checkDb = await client.query(
            "SELECT 1 FROM pg_database WHERE datname = 'portfolio_db'"
        );

        if (checkDb.rows.length > 0) {
            console.log('ℹ️  Database "portfolio_db" already exists');
        } else {
            // Create database
            await client.query('CREATE DATABASE portfolio_db');
            console.log('✅ Database "portfolio_db" created successfully!');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

createDatabase();
