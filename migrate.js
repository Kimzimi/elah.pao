// สคริปต์สำหรับสร้าง database schema
require('dotenv').config({ path: '.env.local' });
const { initDatabase } = require('./db');

async function runMigration() {
    console.log('🚀 Starting database migration...');

    try {
        await initDatabase();
        console.log('✅ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
