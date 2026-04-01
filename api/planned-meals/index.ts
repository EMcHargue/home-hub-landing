import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import sql from "mssql";
import { getPool, errMsg } from "../db";

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
  const method = req.method?.toUpperCase();
  const id = context.bindingData.id;

  try {
    const pool = await getPool();

    if (method === "GET") {
      const { start, end } = req.query;
      const request = pool.request();
      let query = "SELECT * FROM dbo.planned_meals";
      if (start && end) {
        request.input("start", sql.Date, start);
        request.input("end",   sql.Date, end);
        query += " WHERE plan_date BETWEEN @start AND @end";
      }
      query += " ORDER BY plan_date, slot, id";
      const result = await request.query(query);
      const records = result.recordset.map((row: Record<string, unknown>) => {
        return {
          ...row,
          ingredients: row.ingredients ? JSON.parse(row.ingredients as string) : null,
        };
      });
      context.res = { status: 200, body: records };

    } else if (method === "POST") {
      const { plan_date, slot, recipe_id, custom_name, link, ingredients } = req.body;
      if (!plan_date || !slot) {
        context.res = { status: 400, body: { error: "plan_date and slot required" } };
        return;
      }
      const result = await pool
        .request()
        .input("plan_date",   sql.Date,             plan_date)
        .input("slot",        sql.NVarChar(20),     slot)
        .input("recipe_id",   sql.Int,              recipe_id ?? null)
        .input("custom_name", sql.NVarChar(255),    custom_name ?? null)
        .input("link",        sql.NVarChar(500),    link ?? null)
        .input("ingredients", sql.NVarChar(sql.MAX), ingredients?.length ? JSON.stringify(ingredients) : null)
        .query("INSERT INTO dbo.planned_meals (plan_date, slot, recipe_id, custom_name, link, ingredients) OUTPUT INSERTED.id VALUES (@plan_date, @slot, @recipe_id, @custom_name, @link, @ingredients)");
      context.res = { status: 201, body: { id: result.recordset[0].id } };

    } else if (method === "PUT" && id) {
      const { recipe_id, custom_name, link, ingredients } = req.body;
      await pool
        .request()
        .input("id",          sql.Int,              parseInt(id))
        .input("recipe_id",   sql.Int,              recipe_id ?? null)
        .input("custom_name", sql.NVarChar(255),    custom_name ?? null)
        .input("link",        sql.NVarChar(500),    link ?? null)
        .input("ingredients", sql.NVarChar(sql.MAX), ingredients?.length ? JSON.stringify(ingredients) : null)
        .query("UPDATE dbo.planned_meals SET recipe_id = @recipe_id, custom_name = @custom_name, link = @link, ingredients = @ingredients WHERE id = @id");
      context.res = { status: 200, body: { success: true } };

    } else if (method === "DELETE" && id) {
      await pool.request().input("id", sql.Int, parseInt(id)).query("DELETE FROM dbo.planned_meals WHERE id = @id");
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
