import { Router } from "express";
import { getPool } from "../db";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// GET /api/pantry?user_id=...
router.get("/", async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: "user_id required" });
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("user_id", user_id as string)
      .query("SELECT * FROM dbo.pantry_items WHERE user_id = @user_id");
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error" });
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
  } = req.body;
  if (!user_id || !name || quantity == null || !unit || min_quantity == null) {
    return res.status(400).json({ error: "missing required fields" });
  }
  try {
    const id = uuidv4();
    const pool = await getPool();
    await pool
      .request()
      .input("id", id)
      .input("user_id", user_id)
      .input("category_id", category_id || null)
      .input("name", name)
      .input("quantity", quantity)
      .input("unit", unit)
      .input("min_quantity", min_quantity)
      .input("expiration_date", expiration_date || null)
      .query(`
        INSERT INTO dbo.pantry_items
          (id,user_id,category_id,name,quantity,unit,min_quantity,expiration_date)
        VALUES
          (@id,@user_id,@category_id,@name,@quantity,@unit,@min_quantity,@expiration_date)
      `);
    res.status(201).json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error" });
  }
});

// PUT update by id
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const fields = req.body;
  const allowed = [
    "category_id",
    "name",
    "quantity",
    "unit",
    "min_quantity",
    "expiration_date",
  ];
  const setClauses: string[] = [];
  const request = (await getPool()).request();
  allowed.forEach((f) => {
    if (fields[f] !== undefined) {
      setClauses.push(`${f} = @${f}`);
      request.input(f, fields[f]);
    }
  });
  if (setClauses.length === 0) {
    return res.status(400).json({ error: "no updatable fields provided" });
  }
  try {
    request.input("id", id);
    await request.query(`
      UPDATE dbo.pantry_items
      SET ${setClauses.join(",")}
      WHERE id = @id
    `);
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
      .input("id", req.params.id)
      .query("DELETE FROM dbo.pantry_items WHERE id = @id");
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error" });
  }
});

export default router;