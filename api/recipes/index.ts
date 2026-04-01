import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import sql from "mssql";
import { getPool, errMsg } from "../db";

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
  const method = req.method?.toUpperCase();
  const id = context.bindingData.id;

  try {
    const pool = await getPool();

    if (method === "GET") {
      const result = await pool.request().query("SELECT * FROM dbo.recipes ORDER BY name");
      const rows = result.recordset.map((r) => ({
        ...r,
        ingredients: JSON.parse(r.ingredients || "[]"),
        tags: JSON.parse(r.tags || "[]"),
      }));
      context.res = { status: 200, body: rows };

    } else if (method === "POST") {
      const { name, ingredients, instructions, servings, tags } = req.body;
      if (!name) {
        context.res = { status: 400, body: { error: "name required" } };
        return;
      }
      const result = await pool
        .request()
        .input("name",         sql.NVarChar(255),    name)
        .input("ingredients",  sql.NVarChar(sql.MAX), JSON.stringify(ingredients ?? []))
        .input("instructions", sql.NVarChar(sql.MAX), instructions ?? null)
        .input("servings",     sql.Int,              servings ?? 4)
        .input("tags",         sql.NVarChar(sql.MAX), JSON.stringify(tags ?? []))
        .query("INSERT INTO dbo.recipes (name, ingredients, instructions, servings, tags) OUTPUT INSERTED.id VALUES (@name, @ingredients, @instructions, @servings, @tags)");
      context.res = { status: 201, body: { id: result.recordset[0].id } };

    } else if (method === "DELETE" && id) {
      await pool.request().input("id", sql.Int, parseInt(id)).query("DELETE FROM dbo.recipes WHERE id = @id");
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
