import { Pool } from 'pg';
export declare const pool: Pool;
export declare let isDbConnected: boolean;
export declare const initDb: () => Promise<void>;
