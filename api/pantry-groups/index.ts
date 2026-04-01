import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import sql from "mssql";
import { getPool, errMsg } from "../db";

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
  const method = req.method?.toUpperCase();
  const id = context.bindingData.id;

  try {
    const pool = await getPool();

    if (method === "GET") {
      const result = await pool.request().query("SELECT * FROM dbo.pantry_groups ORDER BY name");
      context.res = { status: 200, body: result.recordset };

    } else if (method === "POST") {
      const { user_id, category_id, name } = req.body;
      if (!user_id || !name) {
        context.res = { status: 400, body: { error: "user_id and name required" } };
        return;
      }
      const result = await pool
        .request()
        .input("user_id",     sql.UniqueIdentifier, user_id)
        .input("category_id", sql.Int,              category_id || null)
        .input("name",        sql.NVarChar(255),    name)
        .query("INSERT INTO dbo.pantry_groups (user_id, category_id, name) OUTPUT INSERTED.id VALUES (@user_id, @category_id, @name)");
      context.res = { status: 201, body: { id: result.recordset[0].id } };

    } else if (method === "PUT" && id) {
      const { name, category_id } = req.body;
      const setClauses: string[] = [];
      const request = pool.request().input("id", sql.Int, parseInt(id));
      if (name !== undefined) { request.input("name", sql.NVarChar(255), name); setClauses.push("name = @name"); }
      if (category_id !== undefined) { request.input("category_id", sql.Int, category_id || null); setClauses.push("category_id = @category_id"); }
      if (setClauses.length === 0) {
        context.res = { status: 400, body: { error: "nothing to update" } };
        return;
      }
      await request.query(`UPDATE dbo.pantry_groups SET ${setClauses.join(",")} WHERE id = @id`);
      context.res = { status: 200, body: { success: true } };

    } else if (method === "DELETE" && id) {
      await pool.request().input("id", sql.Int, parseInt(id)).query("DELETE FROM dbo.pantry_groups WHERE id = @id");
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
