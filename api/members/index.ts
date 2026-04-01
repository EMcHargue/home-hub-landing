import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import sql from "mssql";
import { getPool, errMsg } from "../db";
import { v4 as uuidv4 } from "uuid";

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
  const method = req.method?.toUpperCase();
  const id = context.bindingData.id;

  try {
    const pool = await getPool();

    if (method === "GET") {
      const result = await pool.request().query("SELECT id, name, pin, created_at FROM dbo.members ORDER BY created_at");
      context.res = { status: 200, body: result.recordset };

    } else if (method === "POST") {
      const { name, pin } = req.body as { name?: string; pin?: string };
      if (!name || !name.trim()) {
        context.res = { status: 400, body: { error: "name is required" } };
        return;
      }
      const newId = uuidv4();
      await pool
        .request()
        .input("id",   sql.UniqueIdentifier, newId)
        .input("name", sql.NVarChar(100),    name.trim())
        .input("pin",  sql.NVarChar(10),     pin?.trim() || null)
        .query("INSERT INTO dbo.members (id, name, pin) VALUES (@id, @name, @pin)");
      context.res = { status: 201, body: { id: newId, name: name.trim(), pin: pin?.trim() || null } };

    } else if (method === "DELETE" && id) {
      await pool.request().input("id", sql.UniqueIdentifier, id).query("DELETE FROM dbo.members WHERE id = @id");
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
