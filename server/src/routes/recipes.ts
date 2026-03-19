import { Router } from "express";
import sql from "mssql";
import { getPool } from "../db";

const router = Router();

function errMsg(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

// GET /api/recipes
router.get("/", async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT * FROM dbo.recipes ORDER BY name");
    const rows = result.recordset.map((r) => ({
      ...r,
      ingredients: JSON.parse(r.ingredients || "[]"),
      tags: JSON.parse(r.tags || "[]"),
    }));
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error", detail: errMsg(err) });
  }
});

// POST /api/recipes
router.post("/", async (req, res) => {
  const { name, ingredients, instructions, servings, tags } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("name",         sql.NVarChar(255), name)
      .input("ingredients",  sql.NVarChar(sql.MAX), JSON.stringify(ingredients ?? []))
      .input("instructions", sql.NVarChar(sql.MAX), instructions ?? null)
      .input("servings",     sql.Int,           servings ?? 4)
      .input("tags",         sql.NVarChar(sql.MAX), JSON.stringify(tags ?? []))
      .query(
        "INSERT INTO dbo.recipes (name, ingredients, instructions, servings, tags) OUTPUT INSERTED.id VALUES (@name, @ingredients, @instructions, @servings, @tags)"
      );
    res.status(201).json({ id: result.recordset[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error", detail: errMsg(err) });
  }
});

// DELETE /api/recipes/:id
router.delete("/:id", async (req, res) => {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input("id", sql.Int, parseInt(req.params.id))
      .query("DELETE FROM dbo.recipes WHERE id = @id");
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error", detail: errMsg(err) });
  }
});

export default router;
