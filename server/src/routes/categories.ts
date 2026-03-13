import { Router } from "express";
import sql from "mssql";
import { getPool } from "../db";

const router = Router();

function errMsg(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

// GET /api/categories
router.get("/", async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT id, name FROM dbo.categories ORDER BY name");
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error", detail: errMsg(err) });
  }
});

// POST /api/categories
router.post("/", async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("name", sql.NVarChar(255), name)
      .query("INSERT INTO dbo.categories (name) OUTPUT INSERTED.id VALUES (@name)");
    const id = result.recordset[0].id;
    res.status(201).json({ id, name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error", detail: errMsg(err) });
  }
});

export default router;