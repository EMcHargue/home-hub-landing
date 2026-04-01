import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import sql from "mssql";
import { getPool, errMsg } from "../db";

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
  const method = req.method?.toUpperCase();
  const id = context.bindingData.id;

  try {
    const pool = await getPool();

    if (method === "GET") {
      const { week_start } = req.query;
      const request = pool.request();
      let query = "SELECT * FROM dbo.shopping_list_links";
      if (week_start) {
        request.input("week_start", sql.Date, week_start);
        query += " WHERE week_start = @week_start";
      }
      query += " ORDER BY week_start, ingredient_name";
      const result = await request.query(query);
      const records = result.recordset.map((row: Record<string, unknown>) => ({
        ...row,
        meal_names: row.meal_names ? JSON.parse(row.meal_names as string) : [],
      }));
      context.res = { status: 200, body: records };

    } else if (method === "PUT" && !id) {
      const { week_start, ingredient_name, pantry_item_id, meal_names } = req.body;
      if (!week_start || !ingredient_name || pantry_item_id == null) {
        context.res = { status: 400, body: { error: "week_start, ingredient_name, and pantry_item_id required" } };
        return;
      }
      const mealNamesJson = meal_names?.length ? JSON.stringify(meal_names) : null;

      // Delete existing then insert fresh
      await pool
        .request()
        .input("week_start",       sql.Date,         week_start)
        .input("ingredient_name",  sql.NVarChar(255), ingredient_name)
        .query("DELETE FROM dbo.shopping_list_links WHERE week_start = @week_start AND ingredient_name = @ingredient_name");

      let result;
      try {
        result = await pool
          .request()
          .input("week_start",      sql.Date,             week_start)
          .input("ingredient_name", sql.NVarChar(255),    ingredient_name)
          .input("pantry_item_id",  sql.Int,              pantry_item_id)
          .input("meal_names",      sql.NVarChar(sql.MAX), mealNamesJson)
          .query("INSERT INTO dbo.shopping_list_links (week_start, ingredient_name, pantry_item_id, meal_names) OUTPUT INSERTED.id VALUES (@week_start, @ingredient_name, @pantry_item_id, @meal_names)");
      } catch {
        result = await pool
          .request()
          .input("week_start",      sql.Date,          week_start)
          .input("ingredient_name", sql.NVarChar(255), ingredient_name)
          .input("pantry_item_id",  sql.Int,           pantry_item_id)
          .query("INSERT INTO dbo.shopping_list_links (week_start, ingredient_name, pantry_item_id) OUTPUT INSERTED.id VALUES (@week_start, @ingredient_name, @pantry_item_id)");
      }
      context.res = { status: 201, body: { id: result.recordset[0].id } };

    } else if (method === "DELETE" && id) {
      await pool.request().input("id", sql.Int, parseInt(id)).query("DELETE FROM dbo.shopping_list_links WHERE id = @id");
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
