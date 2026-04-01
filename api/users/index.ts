import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import sql from "mssql";
import { getPool, errMsg } from "../db";
import { v4 as uuidv4 } from "uuid";

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
  const method = req.method?.toUpperCase();
  const id = context.bindingData.id;

  try {
    const pool = await getPool();

    if (method === "GET" && id) {
      const result = await pool
        .request()
        .input("id", sql.UniqueIdentifier, id)
        .query("SELECT id, username, email, created_at, updated_at FROM dbo.users WHERE id = @id");
      if (result.recordset.length === 0) {
        context.res = { status: 404, body: "" };
        return;
      }
      context.res = { status: 200, body: result.recordset[0] };

    } else if (method === "POST") {
      const { username, email, password_hash } = req.body;
      if (!username || !email || !password_hash) {
        context.res = { status: 400, body: { error: "username, email, and password_hash required" } };
        return;
      }
      const newId = uuidv4();
      await pool
        .request()
        .input("id",            sql.UniqueIdentifier, newId)
        .input("username",      sql.NVarChar(255),    username)
        .input("email",         sql.NVarChar(255),    email)
        .input("password_hash", sql.NVarChar(255),    password_hash)
        .query("INSERT INTO dbo.users (id, username, email, password_hash) VALUES (@id, @username, @email, @password_hash)");
      context.res = { status: 201, body: { id: newId, username, email } };

    } else {
      context.res = { status: 405, body: { error: "Method not allowed" } };
    }
  } catch (err) {
    console.error(err);
    context.res = { status: 500, body: { error: "database error", detail: errMsg(err) } };
  }
};

export default httpTrigger;
