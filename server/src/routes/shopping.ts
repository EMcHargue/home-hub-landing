import { Router } from "express";
import { getPool } from "../db";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// GET /api/shopping?user_id=...
router.get("/", async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: "user_id required" });
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("user_id", user_id as string)
      .query("SELECT * FROM dbo.shopping_list WHERE user_id = @user_id");
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error" });
  }
});

// POST add item
router.post("/", async (req, res) => {
  const { user_id, pantry_item_id, item_name } = req.body;
  if (!user_id || !item_name) {
    return res.status(400).json({ error: "user_id and item_name required" });
  }
  try {
    const id = uuidv4();
    const pool = await getPool();
    await pool
      .request()
      .input("id", id)
      .input("user_id", user_id)
      .input("pantry_item_id", pantry_item_id || null)
      .input("item_name", item_name)
      .query(
        "INSERT INTO dbo.shopping_list (id,user_id,pantry_item_id,item_name) VALUES (@id,@user_id,@pantry_item_id,@item_name)"
      );
    res.status(201).json({ id });
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
      .query("DELETE FROM dbo.shopping_list WHERE id = @id");
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error" });
  }
});

export default router;