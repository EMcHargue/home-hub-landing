import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import sql from "mssql";
import { getPool, errMsg } from "../db";

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
  const method = req.method?.toUpperCase();
  const id = context.bindingData.id;

  try {
    const pool = await getPool();

    if (method === "GET") {
      const result = await pool.request().query("SELECT * FROM dbo.pantry_items");
      context.res = { status: 200, body: result.recordset };

    } else if (method === "POST") {
      const { user_id, category_id, name, quantity, unit, min_quantity, expiration_date, brand, group_id, frozen, refrigerated } = req.body;
      if (!user_id || !name || quantity == null || !unit || min_quantity == null) {
        context.res = { status: 400, body: { error: "missing required fields" } };
        return;
      }
      const result = await pool
        .request()
        .input("user_id",         sql.UniqueIdentifier, user_id)
        .input("category_id",     sql.Int,              category_id || null)
        .input("name",            sql.NVarChar(255),    name)
        .input("quantity",        sql.Decimal(10, 3),   quantity)
        .input("unit",            sql.NVarChar(50),     unit)
        .input("min_quantity",    sql.Decimal(10, 3),   min_quantity)
        .input("expiration_date", sql.DateTime2,        expiration_date || null)
        .input("brand",           sql.NVarChar(255),    brand || null)
        .input("group_id",        sql.Int,              group_id || null)
        .input("frozen",          sql.Bit,              frozen ? 1 : 0)
        .input("refrigerated",    sql.Bit,              refrigerated ? 1 : 0)
        .query(`INSERT INTO dbo.pantry_items (user_id,category_id,name,quantity,unit,min_quantity,expiration_date,brand,group_id,frozen,refrigerated) OUTPUT INSERTED.id VALUES (@user_id,@category_id,@name,@quantity,@unit,@min_quantity,@expiration_date,@brand,@group_id,@frozen,@refrigerated)`);
      context.res = { status: 201, body: { id: result.recordset[0].id } };

    } else if (method === "PUT" && id) {
      const fields = req.body;
      const allowed = ["category_id", "name", "quantity", "unit", "min_quantity", "expiration_date", "brand", "group_id", "frozen", "refrigerated"];
      const setClauses: string[] = [];
      const request = pool.request().input("id", sql.Int, parseInt(id));
      allowed.forEach((f) => {
        if (fields[f] !== undefined) {
          setClauses.push(`${f} = @${f}`);
          if (f === "group_id" || f === "category_id") request.input(f, sql.Int, fields[f] || null);
          else if (f === "frozen" || f === "refrigerated") request.input(f, sql.Bit, fields[f] ? 1 : 0);
          else request.input(f, fields[f]);
        }
      });
      if (setClauses.length === 0) {
        context.res = { status: 400, body: { error: "no updatable fields provided" } };
        return;
      }
      await request.query(`UPDATE dbo.pantry_items SET ${setClauses.join(",")} WHERE id = @id`);
      context.res = { status: 200, body: { success: true } };

    } else if (method === "DELETE" && id) {
      await pool.request().input("id", sql.Int, parseInt(id)).query("DELETE FROM dbo.pantry_items WHERE id = @id");
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
