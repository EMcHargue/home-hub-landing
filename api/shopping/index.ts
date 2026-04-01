import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import sql from "mssql";
import { getPool, errMsg } from "../db";

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
  const method = req.method?.toUpperCase();
  const id = context.bindingData.id;

  try {
    const pool = await getPool();

    if (method === "GET") {
      const result = await pool.request().query("SELECT * FROM dbo.shopping_list");
      context.res = { status: 200, body: result.recordset };

    } else if (method === "POST") {
      const { user_id, pantry_item_id, item_name, requested_quantity, unit, category_id, group_id } = req.body;
      if (!user_id || !item_name) {
        context.res = { status: 400, body: { error: "user_id and item_name required" } };
        return;
      }
      const result = await pool
        .request()
        .input("user_id",            sql.UniqueIdentifier, user_id)
        .input("pantry_item_id",     sql.Int,              pantry_item_id || null)
        .input("item_name",          sql.NVarChar(255),    item_name)
        .input("requested_quantity", sql.Decimal(10, 3),   requested_quantity ?? null)
        .input("unit",               sql.NVarChar(50),     unit || null)
        .input("category_id",        sql.Int,              category_id || null)
        .input("group_id",           sql.Int,              group_id || null)
        .query("INSERT INTO dbo.shopping_list (user_id, pantry_item_id, item_name, requested_quantity, unit, category_id, group_id) OUTPUT INSERTED.id VALUES (@user_id, @pantry_item_id, @item_name, @requested_quantity, @unit, @category_id, @group_id)");
      context.res = { status: 201, body: { id: result.recordset[0].id } };

    } else if (method === "PUT" && id) {
      const { requested_quantity, unit } = req.body;
      await pool
        .request()
        .input("id",                 sql.Int,            parseInt(id))
        .input("requested_quantity", sql.Decimal(10, 3), requested_quantity ?? null)
        .input("unit",               sql.NVarChar(50),   unit ?? null)
        .query("UPDATE dbo.shopping_list SET requested_quantity = @requested_quantity, unit = @unit WHERE id = @id");
      context.res = { status: 200, body: { success: true } };

    } else if (method === "DELETE" && id) {
      await pool.request().input("id", sql.Int, parseInt(id)).query("DELETE FROM dbo.shopping_list WHERE id = @id");
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
