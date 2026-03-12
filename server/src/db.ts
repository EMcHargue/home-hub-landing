import { ConnectionPool } from "mssql";
import dotenv from "dotenv";

dotenv.config();

// configure via environment variables
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true, // for Azure, set false for local dev if needed
    trustServerCertificate: true,
  },
};

const pool = new ConnectionPool(config);

export async function getPool(): Promise<ConnectionPool> {
  if (!pool.connected) {
    await pool.connect();
  }
  return pool;
}