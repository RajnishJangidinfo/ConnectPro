import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/connectpro';

export const pool = new Pool({
  connectionString
});

export let isDbConnected = false;

export const initDb = async () => {
  try {
    const client = await pool.connect();
    try {
      // Create connections table
      await client.query(`
        CREATE TABLE IF NOT EXISTS connections (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          sender_id VARCHAR(255) NOT NULL,
          receiver_id VARCHAR(255) NOT NULL,
          status VARCHAR(50) DEFAULT 'PENDING',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(sender_id, receiver_id)
        );
      `);

      // Create blocks table
      await client.query(`
        CREATE TABLE IF NOT EXISTS blocks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          blocker_id VARCHAR(255) NOT NULL,
          blocked_id VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(blocker_id, blocked_id)
        );
      `);

      console.log('Connection DB Tables initialized successfully');
      isDbConnected = true;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.warn('\n⚠️ [DATABASE WARNING]: PostgreSQL is not running or credentials rejected. Falling back to IN-MEMORY graph mock storage!\n');
    isDbConnected = false;
  }
};
