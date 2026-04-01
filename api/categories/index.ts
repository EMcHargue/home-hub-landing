import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import sql from "mssql";
import { getPool, errMsg } from "../db";

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
  const method = req.method?.toUpperCase();

  try {
    const pool = await getPool();

    if (method === "GET") {
      const result = await pool.request().query("SELECT id, name FROM dbo.categories ORDER BY name");
      context.res = { status: 200, body: result.recordset };

    } else if (method === "POST") {
      const { name } = req.body;
      if (!name) {
        context.res = { status: 400, body: { error: "name required" } };
        return;
      }
      const result = await pool
        .request()
        .input("name", sql.NVarChar(255), name)
        .query("INSERT INTO dbo.categories (name) OUTPUT INSERTED.id VALUES (@name)");
      const id = result.recordset[0].id;
      context.res = { status: 201, body: { id, name } };

    } else {
      context.res = { status: 405, body: { error: "Method not allowed" } };
    }
  } catch (err) {
    console.error(err);
    context.res = { status: 500, body: { error: "database error", detail: errMsg(err) } };
  }
};

export default httpTrigger;
