import { Router } from "express";
import { getPool } from "../db";

const router = Router();

// list all categories
router.get("/", async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT id, name FROM dbo.categories ORDER BY name");
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error" });
  }
});

export default router;