import { ConnectionPool } from "mssql";
import dotenv from "dotenv";
dotenv.config();

const config = {
  user: process.env.DB_USER || "",
  password: process.env.DB_PASSWORD || "",
  server: process.env.DB_SERVER || "",
  database: process.env.DB_NAME || "",
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

let pool: ConnectionPool | null = null;

export async function getPool(): Promise<ConnectionPool> {
  if (!pool) {
    pool = new ConnectionPool(config);
  }
  if (!pool.connected) {
    await pool.connect();
  }
  return pool;
}

export function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
