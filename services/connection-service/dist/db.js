"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDb = exports.isDbConnected = exports.pool = void 0;
const pg_1 = require("pg");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/connectpro';
exports.pool = new pg_1.Pool({
    connectionString
});
exports.isDbConnected = false;
const initDb = async () => {
    try {
        const client = await exports.pool.connect();
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
            exports.isDbConnected = true;
        }
        finally {
            client.release();
        }
    }
    catch (err) {
        console.warn('\n⚠️ [DATABASE WARNING]: PostgreSQL is not running or credentials rejected. Falling back to IN-MEMORY graph mock storage!\n');
        exports.isDbConnected = false;
    }
};
exports.initDb = initDb;
//# sourceMappingURL=db.js.map