import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import sql from "mssql";
import { getPool, errMsg } from "../db";

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
  const method = req.method?.toUpperCase();
  const id = context.bindingData.id;

  try {
    const pool = await getPool();

    if (method === "GET") {
      const result = await pool.request().query("SELECT * FROM dbo.tasks ORDER BY created_at DESC");
      context.res = { status: 200, body: result.recordset };

    } else if (method === "POST") {
      const { title, description, assignee_id, due_date } = req.body;
      if (!title) {
        context.res = { status: 400, body: { error: "title is required" } };
        return;
      }
      const result = await pool
        .request()
        .input("title",       sql.NVarChar(255), title)
        .input("description", sql.NVarChar(500), description || null)
        .input("assignee_id", sql.UniqueIdentifier, assignee_id || null)
        .input("due_date",    sql.Date,          due_date || null)
        .query(`INSERT INTO dbo.tasks (title, description, assignee_id, due_date)
                OUTPUT INSERTED.*
                VALUES (@title, @description, @assignee_id, @due_date)`);
      context.res = { status: 201, body: result.recordset[0] };

    } else if (method === "PUT" && id) {
      const { title, description, assignee_id, due_date, completed } = req.body;
      const setClauses: string[] = [];
      const request = pool.request().input("id", sql.UniqueIdentifier, id);

      if (title !== undefined) { request.input("title", sql.NVarChar(255), title); setClauses.push("title = @title"); }
      if (description !== undefined) { request.input("description", sql.NVarChar(500), description); setClauses.push("description = @description"); }
      if (assignee_id !== undefined) { request.input("assignee_id", sql.UniqueIdentifier, assignee_id || null); setClauses.push("assignee_id = @assignee_id"); }
      if (due_date !== undefined) { request.input("due_date", sql.Date, due_date || null); setClauses.push("due_date = @due_date"); }
      if (completed !== undefined) {
        request.input("completed", sql.Bit, completed ? 1 : 0);
        request.input("completed_at", sql.DateTime2, completed ? new Date() : null);
        setClauses.push("completed = @completed", "completed_at = @completed_at");
      }

      if (setClauses.length === 0) {
        context.res = { status: 400, body: { error: "nothing to update" } };
        return;
      }
      await request.query(`UPDATE dbo.tasks SET ${setClauses.join(", ")} WHERE id = @id`);
      context.res = { status: 200, body: { success: true } };

    } else if (method === "DELETE" && id) {
      await pool.request().input("id", sql.UniqueIdentifier, id).query("DELETE FROM dbo.tasks WHERE id = @id");
      context.res = { status: 200, body: { success: true } };

    } else {
      context.res = { status: 405, body: { error: "Method not allowed" } };
    }
  } catch (err) {
    console.error(err);
    context.res = { status: 500, body: { error: "database error", detail: errMsg(err) } };
  }
};

export default httpTrigger;
