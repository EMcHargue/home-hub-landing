import { Router } from "express";
import sql from "mssql";
import { getPool } from "../db";

const router = Router();

function errMsg(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

// GET /api/planned-meals?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get("/", async (req, res) => {
  const { start, end } = req.query;
  try {
    const pool = await getPool();
    const request = pool.request();
    let query = "SELECT * FROM dbo.planned_meals";
    if (start && end) {
      request.input("start", sql.Date, start as string);
      request.input("end",   sql.Date, end as string);
      query += " WHERE plan_date BETWEEN @start AND @end";
    }
    query += " ORDER BY plan_date, slot, id";
    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error", detail: errMsg(err) });
  }
});

// POST /api/planned-meals  (insert a new item for this date+slot)
router.post("/", async (req, res) => {
  const { plan_date, slot, recipe_id, custom_name, link } = req.body;
  if (!plan_date || !slot) return res.status(400).json({ error: "plan_date and slot required" });
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("plan_date",   sql.Date,           plan_date)
      .input("slot",        sql.NVarChar(20),    slot)
      .input("recipe_id",   sql.Int,             recipe_id ?? null)
      .input("custom_name", sql.NVarChar(255),   custom_name ?? null)
      .input("link",        sql.NVarChar(500),   link ?? null)
      .query(
        "INSERT INTO dbo.planned_meals (plan_date, slot, recipe_id, custom_name, link) OUTPUT INSERTED.id VALUES (@plan_date, @slot, @recipe_id, @custom_name, @link)"
      );
    res.status(201).json({ id: result.recordset[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error", detail: errMsg(err) });
  }
});

// PUT /api/planned-meals/:id  (edit existing item)
router.put("/:id", async (req, res) => {
  const { recipe_id, custom_name, link } = req.body;
  try {
    const pool = await getPool();
    await pool
      .request()
      .input("id",          sql.Int,           parseInt(req.params.id))
      .input("recipe_id",   sql.Int,           recipe_id ?? null)
      .input("custom_name", sql.NVarChar(255), custom_name ?? null)
      .input("link",        sql.NVarChar(500), link ?? null)
      .query("UPDATE dbo.planned_meals SET recipe_id = @recipe_id, custom_name = @custom_name, link = @link WHERE id = @id");
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error", detail: errMsg(err) });
  }
});

// DELETE /api/planned-meals/:id
router.delete("/:id", async (req, res) => {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input("id", sql.Int, parseInt(req.params.id))
      .query("DELETE FROM dbo.planned_meals WHERE id = @id");
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error", detail: errMsg(err) });
  }
});

export default router;
