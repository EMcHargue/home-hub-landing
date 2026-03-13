import { Router } from "express";
import sql from "mssql";
import { getPool } from "../db";

const router = Router();

// GET /api/shopping?user_id=...
router.get("/", async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: "user_id required" });
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("user_id", sql.UniqueIdentifier, user_id as string)
      .query("SELECT * FROM dbo.shopping_list WHERE user_id = @user_id");
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error" });
  }
});

// POST add item
router.post("/", async (req, res) => {
  const { user_id, pantry_item_id, item_name, requested_quantity, unit } = req.body;
  if (!user_id || !item_name) {
    return res.status(400).json({ error: "user_id and item_name required" });
  }
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("user_id",            sql.UniqueIdentifier, user_id)
      .input("pantry_item_id",     sql.Int,              pantry_item_id || null)
      .input("item_name",          sql.NVarChar(255),    item_name)
      .input("requested_quantity", sql.Decimal(10, 3),   requested_quantity ?? null)
      .input("unit",               sql.NVarChar(50),     unit || null)
      .query(
        "INSERT INTO dbo.shopping_list (user_id, pantry_item_id, item_name, requested_quantity, unit) OUTPUT INSERTED.id VALUES (@user_id, @pantry_item_id, @item_name, @requested_quantity, @unit)"
      );
    res.status(201).json({ id: result.recordset[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error" });
  }
});

// PUT update requested_quantity / unit
router.put("/:id", async (req, res) => {
  const { requested_quantity, unit } = req.body;
  try {
    const pool = await getPool();
    await pool
      .request()
      .input("id",                 sql.Int,           parseInt(req.params.id))
      .input("requested_quantity", sql.Decimal(10, 3), requested_quantity ?? null)
      .input("unit",               sql.NVarChar(50),   unit ?? null)
      .query("UPDATE dbo.shopping_list SET requested_quantity = @requested_quantity, unit = @unit WHERE id = @id");
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error" });
  }
});

// DELETE
router.delete("/:id", async (req, res) => {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input("id", sql.Int, parseInt(req.params.id))
      .query("DELETE FROM dbo.shopping_list WHERE id = @id");
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error" });
  }
});

export default router;
