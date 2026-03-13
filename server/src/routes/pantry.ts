import { Router } from "express";
import sql from "mssql";
import { getPool } from "../db";

function errMsg(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

const router = Router();

// GET /api/pantry?user_id=...
router.get("/", async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: "user_id required" });
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("user_id", sql.UniqueIdentifier, user_id as string)
      .query("SELECT * FROM dbo.pantry_items WHERE user_id = @user_id");
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error", detail: errMsg(err) });
  }
});

// POST create
router.post("/", async (req, res) => {
  const {
    user_id,
    category_id,
    name,
    quantity,
    unit,
    min_quantity,
    expiration_date,
    brand,
    group_id,
  } = req.body;
  if (!user_id || !name || quantity == null || !unit || min_quantity == null) {
    return res.status(400).json({ error: "missing required fields" });
  }
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("user_id",         sql.UniqueIdentifier, user_id)
      .input("category_id",     sql.Int,              category_id || null)
      .input("name",            sql.NVarChar(255),    name)
      .input("quantity",        sql.Decimal(10, 3),   quantity)
      .input("unit",            sql.NVarChar(50),     unit)
      .input("min_quantity",    sql.Decimal(10, 3),   min_quantity)
      .input("expiration_date", sql.DateTime2,        expiration_date || null)
      .input("brand",           sql.NVarChar(255),    brand || null)
      .input("group_id",        sql.Int,              group_id || null)
      .query(`
        INSERT INTO dbo.pantry_items
          (user_id,category_id,name,quantity,unit,min_quantity,expiration_date,brand,group_id)
        OUTPUT INSERTED.id
        VALUES
          (@user_id,@category_id,@name,@quantity,@unit,@min_quantity,@expiration_date,@brand,@group_id)
      `);
    res.status(201).json({ id: result.recordset[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error", detail: errMsg(err) });
  }
});

// PUT update by id
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const fields = req.body;

  const allowed = ["category_id", "name", "quantity", "unit", "min_quantity", "expiration_date", "brand", "group_id"];
  const setClauses: string[] = [];
  const request = (await getPool()).request().input("id", sql.Int, parseInt(id));

  allowed.forEach((f) => {
    if (fields[f] !== undefined) {
      setClauses.push(`${f} = @${f}`);
      if (f === "group_id" || f === "category_id") {
        request.input(f, sql.Int, fields[f] || null);
      } else {
        request.input(f, fields[f]);
      }
    }
  });

  if (setClauses.length === 0) {
    return res.status(400).json({ error: "no updatable fields provided" });
  }
  try {
    await request.query(`UPDATE dbo.pantry_items SET ${setClauses.join(",")} WHERE id = @id`);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error", detail: errMsg(err) });
  }
});

// DELETE
router.delete("/:id", async (req, res) => {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input("id", sql.Int, parseInt(req.params.id))
      .query("DELETE FROM dbo.pantry_items WHERE id = @id");
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error", detail: errMsg(err) });
  }
});

export default router;
