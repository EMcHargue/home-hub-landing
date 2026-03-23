import { Router } from "express";
import sql from "mssql";
import { getPool } from "../db";

const router = Router();

function errMsg(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

// GET /api/shopping-list-links?week_start=YYYY-MM-DD
// Returns all links, optionally filtered to a specific week
router.get("/", async (req, res) => {
  const { week_start } = req.query;
  try {
    const pool = await getPool();
    const request = pool.request();
    let query = "SELECT * FROM dbo.shopping_list_links";
    if (week_start) {
      request.input("week_start", sql.Date, week_start as string);
      query += " WHERE week_start = @week_start";
    }
    query += " ORDER BY week_start, ingredient_name";
    const result = await request.query(query);
    const records = result.recordset.map((row: Record<string, unknown>) => ({
      ...row,
      meal_names: row.meal_names ? JSON.parse(row.meal_names as string) : [],
    }));
    res.json(records);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error", detail: errMsg(err) });
  }
});

// PUT /api/shopping-list-links  (upsert by week_start + ingredient_name)
router.put("/", async (req, res) => {
  const { week_start, ingredient_name, pantry_item_id, meal_names } = req.body;
  if (!week_start || !ingredient_name || pantry_item_id == null) {
    return res.status(400).json({ error: "week_start, ingredient_name, and pantry_item_id required" });
  }
  const mealNamesJson = meal_names?.length ? JSON.stringify(meal_names) : null;
  try {
    const pool = await getPool();
    // Delete existing link for this week + ingredient, then insert fresh
    await pool
      .request()
      .input("week_start", sql.Date, week_start)
      .input("ingredient_name", sql.NVarChar(255), ingredient_name)
      .query("DELETE FROM dbo.shopping_list_links WHERE week_start = @week_start AND ingredient_name = @ingredient_name");

    // Try inserting with meal_names; fall back if the column hasn't been migrated yet
    let result;
    try {
      result = await pool
        .request()
        .input("week_start", sql.Date, week_start)
        .input("ingredient_name", sql.NVarChar(255), ingredient_name)
        .input("pantry_item_id", sql.Int, pantry_item_id)
        .input("meal_names", sql.NVarChar(sql.MAX), mealNamesJson)
        .query(
          "INSERT INTO dbo.shopping_list_links (week_start, ingredient_name, pantry_item_id, meal_names) OUTPUT INSERTED.id VALUES (@week_start, @ingredient_name, @pantry_item_id, @meal_names)"
        );
    } catch {
      // meal_names column doesn't exist yet — insert without it
      result = await pool
        .request()
        .input("week_start", sql.Date, week_start)
        .input("ingredient_name", sql.NVarChar(255), ingredient_name)
        .input("pantry_item_id", sql.Int, pantry_item_id)
        .query(
          "INSERT INTO dbo.shopping_list_links (week_start, ingredient_name, pantry_item_id) OUTPUT INSERTED.id VALUES (@week_start, @ingredient_name, @pantry_item_id)"
        );
    }
    res.status(201).json({ id: result.recordset[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error", detail: errMsg(err) });
  }
});

// DELETE /api/shopping-list-links/:id
router.delete("/:id", async (req, res) => {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input("id", sql.Int, parseInt(req.params.id))
      .query("DELETE FROM dbo.shopping_list_links WHERE id = @id");
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error", detail: errMsg(err) });
  }
});

export default router;
