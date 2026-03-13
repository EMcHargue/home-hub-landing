import { Router } from "express";
import sql from "mssql";
import { getPool } from "../db";

const router = Router();

function errMsg(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

// GET /api/pantry-groups?user_id=...
router.get("/", async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: "user_id required" });
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("user_id", sql.UniqueIdentifier, user_id as string)
      .query("SELECT * FROM dbo.pantry_groups WHERE user_id = @user_id ORDER BY name");
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error", detail: errMsg(err) });
  }
});

// POST /api/pantry-groups
router.post("/", async (req, res) => {
  const { user_id, category_id, name } = req.body;
  if (!user_id || !name) return res.status(400).json({ error: "user_id and name required" });
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("user_id",     sql.UniqueIdentifier, user_id)
      .input("category_id", sql.Int,              category_id || null)
      .input("name",        sql.NVarChar(255),    name)
      .query(
        "INSERT INTO dbo.pantry_groups (user_id, category_id, name) OUTPUT INSERTED.id VALUES (@user_id, @category_id, @name)"
      );
    res.status(201).json({ id: result.recordset[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error", detail: errMsg(err) });
  }
});

// PUT /api/pantry-groups/:id
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, category_id } = req.body;
  const setClauses: string[] = [];
  try {
    const pool = await getPool();
    const request = pool.request().input("id", sql.Int, parseInt(id));
    if (name !== undefined) {
      request.input("name", sql.NVarChar(255), name);
      setClauses.push("name = @name");
    }
    if (category_id !== undefined) {
      request.input("category_id", sql.Int, category_id || null);
      setClauses.push("category_id = @category_id");
    }
    if (setClauses.length === 0) return res.status(400).json({ error: "nothing to update" });
    await request.query(`UPDATE dbo.pantry_groups SET ${setClauses.join(",")} WHERE id = @id`);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error", detail: errMsg(err) });
  }
});

// DELETE /api/pantry-groups/:id  (items become standalone via ON DELETE SET NULL)
router.delete("/:id", async (req, res) => {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input("id", sql.Int, parseInt(req.params.id))
      .query("DELETE FROM dbo.pantry_groups WHERE id = @id");
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error", detail: errMsg(err) });
  }
});

export default router;
