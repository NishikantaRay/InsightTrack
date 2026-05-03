import { createPool, initializeDatabase, closeConnection } from '../src/db/postgres.js';
import dotenv from 'dotenv';

dotenv.config();

async function migrate() {
    console.log('🔧 Running PostgreSQL migrations...\n');

    try {
        createPool();
        await initializeDatabase();
        console.log('\n✅ Migrations completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await closeConnection();
    }
}

migrate();
