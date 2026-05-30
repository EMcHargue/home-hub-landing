import { Router } from "express";
import sql from "mssql";
import { getPool } from "../db";
import { v4 as uuidv4 } from "uuid";

const router = Router();

function errMsg(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function deriveTOD(start_time: string | undefined, all_day: boolean): string {
  if (all_day) return "all_day";
  if (!start_time) return "morning";
  const h = parseInt(start_time.split(":")[0], 10);
  if (h >= 12 && h < 18) return "afternoon";
  if (h >= 18) return "evening";
  return "morning";
}

// GET /api/calendar-entries?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get("/", async (req, res) => {
  const { start, end } = req.query;
  try {
    const pool = await getPool();
    const request = pool.request();
    let query = "SELECT id, title, description, entry_date, start_time, end_time, all_day, time_of_day, color, created_at FROM dbo.calendar_entries";
    if (start && end) {
      request.input("start", sql.Date, start as string);
      request.input("end",   sql.Date, end   as string);
      query += " WHERE entry_date BETWEEN @start AND @end";
    }
    query += " ORDER BY entry_date, start_time, created_at";
    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error", detail: errMsg(err) });
  }
});

// POST /api/calendar-entries
router.post("/", async (req, res) => {
  const { title, description, entry_date, start_time, end_time, all_day, time_of_day, color } = req.body as {
    title?: string; description?: string; entry_date?: string;
    start_time?: string; end_time?: string; all_day?: boolean;
    time_of_day?: string; color?: string;
  };
  if (!title?.trim()) return res.status(400).json({ error: "title is required" });
  if (!entry_date)    return res.status(400).json({ error: "entry_date is required" });

  const isAllDay = all_day ?? true;
  const tod = time_of_day || deriveTOD(start_time, isAllDay);

  try {
    const pool = await getPool();
    const id = uuidv4();
    await pool.request()
      .input("id",          sql.UniqueIdentifier, id)
      .input("title",       sql.NVarChar(255),    title.trim())
      .input("description", sql.NVarChar(1000),   description?.trim() || null)
      .input("entry_date",  sql.Date,             entry_date)
      .input("start_time",  sql.NVarChar(5),      start_time || null)
      .input("end_time",    sql.NVarChar(5),      end_time   || null)
      .input("all_day",     sql.Bit,              isAllDay)
      .input("time_of_day", sql.NVarChar(20),     tod)
      .input("color",       sql.NVarChar(20),     color || null)
      .query(`INSERT INTO dbo.calendar_entries
                (id, title, description, entry_date, start_time, end_time, all_day, time_of_day, color)
              VALUES
                (@id, @title, @description, @entry_date, @start_time, @end_time, @all_day, @time_of_day, @color)`);
    res.status(201).json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error", detail: errMsg(err) });
  }
});

// PUT /api/calendar-entries/:id
router.put("/:id", async (req, res) => {
  const { title, description, entry_date, start_time, end_time, all_day, time_of_day, color } = req.body as {
    title?: string; description?: string; entry_date?: string;
    start_time?: string | null; end_time?: string | null; all_day?: boolean;
    time_of_day?: string; color?: string | null;
  };

  const isAllDay = all_day ?? false;
  const tod = time_of_day || deriveTOD(start_time ?? undefined, isAllDay);

  try {
    const pool = await getPool();
    await pool.request()
      .input("id",          sql.UniqueIdentifier, req.params.id)
      .input("title",       sql.NVarChar(255),    title?.trim() || null)
      .input("description", sql.NVarChar(1000),   description?.trim() || null)
      .input("entry_date",  sql.Date,             entry_date || null)
      .input("start_time",  sql.NVarChar(5),      start_time ?? null)
      .input("end_time",    sql.NVarChar(5),      end_time   ?? null)
      .input("all_day",     sql.Bit,              isAllDay)
      .input("time_of_day", sql.NVarChar(20),     tod)
      .input("color",       sql.NVarChar(20),     color ?? null)
      .query(`UPDATE dbo.calendar_entries SET
        title       = COALESCE(@title, title),
        description = @description,
        entry_date  = COALESCE(@entry_date, entry_date),
        start_time  = @start_time,
        end_time    = @end_time,
        all_day     = @all_day,
        time_of_day = @time_of_day,
        color       = @color
      WHERE id = @id`);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error", detail: errMsg(err) });
  }
});

// DELETE /api/calendar-entries/:id
router.delete("/:id", async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input("id", sql.UniqueIdentifier, req.params.id)
      .query("DELETE FROM dbo.calendar_entries WHERE id = @id");
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database error", detail: errMsg(err) });
  }
});

export default router;
