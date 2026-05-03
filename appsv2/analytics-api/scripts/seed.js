import { createPool, initializeDatabase, generateSampleData, closeConnection } from '../src/db/postgres.js';
import dotenv from 'dotenv';

dotenv.config();

async function seed() {
    console.log('🌱 Seeding PostgreSQL with sample data...\n');

    try {
        createPool();
        await initializeDatabase();
        await generateSampleData();
        console.log('\n✅ Seeding completed successfully!');
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    } finally {
        await closeConnection();
    }
}

seed();
