import { Router } from "express";
import sql from "mssql";
import { getPool } from "../db";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// GET all chores
router.get("/", async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .query("SELECT id, title, description, assignee_id, completed, completed_at, created_at, due_date, start_date, end_date, recurrence FROM dbo.chores ORDER BY due_date, created_at");
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error" });
  }
});

// POST create chore — generates all instances for recurring chores
router.post("/", async (req, res) => {
  const { title, description, assignee_id, due_date, start_date, end_date, recurrence } = req.body as {
    title?: string; description?: string; assignee_id?: string;
    due_date?: string; start_date?: string; end_date?: string; recurrence?: string;
  };
  if (!title || !title.trim()) return res.status(400).json({ error: "title is required" });

  try {
    const pool = await getPool();
    const freq = recurrence || "none";

    // For recurring chores, generate all instances
    if (freq !== "none" && start_date && end_date) {
      const start = new Date(start_date);
      const end = new Date(end_date);
      const dates: Date[] = [];
      const cur = new Date(start);

      while (cur <= end) {
        dates.push(new Date(cur));
        if (freq === "daily")        cur.setDate(cur.getDate() + 1);
        else if (freq === "weekly")  cur.setDate(cur.getDate() + 7);
        else if (freq === "monthly") cur.setMonth(cur.getMonth() + 1);
        else break;
      }

      const ids: string[] = [];
      for (const d of dates) {
        const id = uuidv4();
        await pool.request()
          .input("id",          sql.UniqueIdentifier, id)
          .input("title",       sql.NVarChar(255),    title.trim())
          .input("description", sql.NVarChar(500),    description?.trim() || null)
          .input("assignee_id", sql.UniqueIdentifier, assignee_id || null)
          .input("due_date",    sql.Date,             d)
          .input("start_date",  sql.Date,             start)
          .input("end_date",    sql.Date,             end)
          .input("recurrence",  sql.NVarChar(20),     freq)
          .query(`INSERT INTO dbo.chores (id, title, description, assignee_id, due_date, start_date, end_date, recurrence)
                  VALUES (@id, @title, @description, @assignee_id, @due_date, @start_date, @end_date, @recurrence)`);
        ids.push(id);
      }
      return res.status(201).json({ ids, count: ids.length });
    }

    // One-time chore
    const id = uuidv4();
    await pool.request()
      .input("id",          sql.UniqueIdentifier, id)
      .input("title",       sql.NVarChar(255),    title.trim())
      .input("description", sql.NVarChar(500),    description?.trim() || null)
      .input("assignee_id", sql.UniqueIdentifier, assignee_id || null)
      .input("due_date",    sql.Date,             due_date || null)
      .input("start_date",  sql.Date,             null)
      .input("end_date",    sql.Date,             null)
      .input("recurrence",  sql.NVarChar(20),     "none")
      .query(`INSERT INTO dbo.chores (id, title, description, assignee_id, due_date, start_date, end_date, recurrence)
              VALUES (@id, @title, @description, @assignee_id, @due_date, @start_date, @end_date, @recurrence)`);
    res.status(201).json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error" });
  }
});

// PUT update chore
router.put("/:id", async (req, res) => {
  const { title, description, assignee_id, due_date, start_date, end_date, recurrence, completed } = req.body as {
    title?: string; description?: string; assignee_id?: string;
    due_date?: string; start_date?: string; end_date?: string;
    recurrence?: string; completed?: boolean;
  };
  try {
    const pool = await getPool();
    await pool.request()
      .input("id",          sql.UniqueIdentifier, req.params.id)
      .input("title",       sql.NVarChar(255),    title?.trim() || null)
      .input("description", sql.NVarChar(500),    description?.trim() || null)
      .input("assignee_id", sql.UniqueIdentifier, assignee_id || null)
      .input("due_date",    sql.Date,             due_date || null)
      .input("start_date",  sql.Date,             start_date || null)
      .input("end_date",    sql.Date,             end_date || null)
      .input("recurrence",  sql.NVarChar(20),     recurrence || null)
      .input("completed",   sql.Bit,              completed ?? null)
      .input("completed_at",sql.DateTime2,        completed ? new Date() : null)
      .query(`UPDATE dbo.chores SET
        title        = COALESCE(@title, title),
        description  = COALESCE(@description, description),
        assignee_id  = @assignee_id,
        due_date     = @due_date,
        start_date   = @start_date,
        end_date     = @end_date,
        recurrence   = COALESCE(@recurrence, recurrence),
        completed    = COALESCE(@completed, completed),
        completed_at = CASE WHEN @completed IS NOT NULL THEN @completed_at ELSE completed_at END
      WHERE id = @id`);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error" });
  }
});

// DELETE chore
router.delete("/:id", async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input("id", sql.UniqueIdentifier, req.params.id)
      .query("DELETE FROM dbo.chores WHERE id = @id");
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error" });
  }
});

export default router;
