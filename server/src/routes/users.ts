import { Router } from "express";
import sql from "mssql";
import { getPool } from "../db";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// register a new user (simple example, no auth)
router.post("/", async (req, res) => {
  const { username, email, password_hash } = req.body;
  if (!username || !email || !password_hash) {
    return res.status(400).json({ error: "username, email, and password_hash required" });
  }
  try {
    const pool = await getPool();
    const id = uuidv4();
    await pool
      .request()
      .input("id",            sql.UniqueIdentifier, id)
      .input("username",      sql.NVarChar(255),    username)
      .input("email",         sql.NVarChar(255),    email)
      .input("password_hash", sql.NVarChar(255),    password_hash)
      .query(
        "INSERT INTO dbo.users (id, username, email, password_hash) VALUES (@id, @username, @email, @password_hash)"
      );
    res.status(201).json({ id, username, email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error" });
  }
});

// get user by id
router.get("/:id", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.UniqueIdentifier, req.params.id)
      .query("SELECT id, username, email, created_at, updated_at FROM dbo.users WHERE id = @id");
    if (result.recordset.length === 0) return res.status(404).end();
    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error" });
  }
});

export default router;