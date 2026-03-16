import { Router } from "express";
import sql from "mssql";
import { getPool } from "../db";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// GET all members
router.get("/", async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .query("SELECT id, name, pin, created_at FROM dbo.members ORDER BY created_at");
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error" });
  }
});

// POST create member
router.post("/", async (req, res) => {
  const { name, pin } = req.body as { name?: string; pin?: string };
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  try {
    const pool = await getPool();
    const id = uuidv4();
    await pool
      .request()
      .input("id",   sql.UniqueIdentifier, id)
      .input("name", sql.NVarChar(100),    name.trim())
      .input("pin",  sql.NVarChar(10),     pin?.trim() || null)
      .query(
        "INSERT INTO dbo.members (id, name, pin) VALUES (@id, @name, @pin)"
      );
    res.status(201).json({ id, name: name.trim(), pin: pin?.trim() || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error" });
  }
});

// DELETE member by id
router.delete("/:id", async (req, res) => {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input("id", sql.UniqueIdentifier, req.params.id)
      .query("DELETE FROM dbo.members WHERE id = @id");
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error" });
  }
});

export default router;
