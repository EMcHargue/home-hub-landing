import { Router } from "express";
import sql from "mssql";
import { getPool } from "../db";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// GET all tasks
router.get("/", async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(
      "SELECT id, title, description, assignee_id, completed, completed_at, created_at, due_date, time_of_day, scheduled_time FROM dbo.tasks ORDER BY created_at"
    );
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error" });
  }
});

// POST create task
router.post("/", async (req, res) => {
  const { title, description, assignee_id, due_date, time_of_day, scheduled_time } = req.body as {
    title?: string; description?: string; assignee_id?: string; due_date?: string; time_of_day?: string; scheduled_time?: string;
  };
  if (!title || !title.trim()) return res.status(400).json({ error: "title is required" });
  try {
    const pool = await getPool();
    const id = uuidv4();
    await pool.request()
      .input("id",             sql.UniqueIdentifier, id)
      .input("title",          sql.NVarChar(255),    title.trim())
      .input("description",    sql.NVarChar(500),    description?.trim() || null)
      .input("assignee_id",    sql.UniqueIdentifier, assignee_id || null)
      .input("due_date",       sql.Date,             due_date || null)
      .input("time_of_day",    sql.NVarChar(20),     time_of_day || "afternoon")
      .input("scheduled_time", sql.NVarChar(5),      scheduled_time || null)
      .query(`INSERT INTO dbo.tasks (id, title, description, assignee_id, due_date, time_of_day, scheduled_time)
              VALUES (@id, @title, @description, @assignee_id, @due_date, @time_of_day, @scheduled_time)`);
    res.status(201).json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error" });
  }
});

// PUT update task
router.put("/:id", async (req, res) => {
  const { title, description, assignee_id, due_date, completed, time_of_day, scheduled_time } = req.body as {
    title?: string; description?: string; assignee_id?: string;
    due_date?: string; completed?: boolean; time_of_day?: string; scheduled_time?: string | null;
  };
  // Only overwrite scheduled_time when the caller explicitly sent the field
  const updateScheduledTime = "scheduled_time" in req.body ? 1 : 0;
  try {
    const pool = await getPool();
    await pool.request()
      .input("id",                    sql.UniqueIdentifier, req.params.id)
      .input("title",                 sql.NVarChar(255),    title?.trim() || null)
      .input("description",           sql.NVarChar(500),    description?.trim() || null)
      .input("assignee_id",           sql.UniqueIdentifier, assignee_id || null)
      .input("due_date",              sql.Date,             due_date || null)
      .input("time_of_day",           sql.NVarChar(20),     time_of_day || null)
      .input("scheduled_time",        sql.NVarChar(5),      scheduled_time ?? null)
      .input("update_scheduled_time", sql.Bit,              updateScheduledTime)
      .input("completed",             sql.Bit,              completed ?? null)
      .input("completed_at",          sql.DateTime2,        completed ? new Date() : null)
      .query(`UPDATE dbo.tasks SET
        title          = COALESCE(@title, title),
        description    = COALESCE(@description, description),
        assignee_id    = @assignee_id,
        due_date       = @due_date,
        time_of_day    = COALESCE(@time_of_day, time_of_day),
        scheduled_time = CASE WHEN @update_scheduled_time = 1 THEN @scheduled_time ELSE scheduled_time END,
        completed      = COALESCE(@completed, completed),
        completed_at   = CASE WHEN @completed IS NOT NULL THEN @completed_at ELSE completed_at END
      WHERE id = @id`);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error" });
  }
});

// DELETE task
router.delete("/:id", async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input("id", sql.UniqueIdentifier, req.params.id)
      .query("DELETE FROM dbo.tasks WHERE id = @id");
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error" });
  }
});

export default router;