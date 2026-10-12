import { randomUUID } from "node:crypto";

export const nativeSql = Boolean(process.env.SQL_NATIVE_DATABASE_URL);

export async function createTestDatabase() {
  if (!nativeSql) {
    const { PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite");
    return new PGlite();
  }
  const target = new URL(process.env.SQL_NATIVE_DATABASE_URL);
  if (
    !["postgres:", "postgresql:"].includes(target.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
    (process.env.CI !== "true" && process.env.SQL_NATIVE_ISOLATED !== "1")
  ) {
    throw new Error("Native SQL tests require an explicitly isolated loopback PostgreSQL server.");
  }
  const pgModule = await import(process.env.SQL_NATIVE_PG_MODULE || "pg");
  const { Client, types } = pgModule.default ?? pgModule;
  types.setTypeParser(20, (value) => {
    const number = Number(value);
    if (!Number.isSafeInteger(number)) throw new Error("SQL test integer overflow");
    return number;
  });
  const admin = new Client({ connectionString: target.toString() });
  await admin.connect();
  const database = `qa_wallet_${randomUUID().replaceAll("-", "")}`;
  await admin.query(`CREATE DATABASE ${database}`);
  target.pathname = `/${database}`;
  const connect = async () => {
    const client = new Client({
      connectionString: target.toString(),
      options: "-c statement_timeout=15000",
    });
    await client.connect();
    return {
      exec: (sql) => client.query(sql),
      query: (sql) => client.query(sql),
      close: () => client.end(),
    };
  };
  const db = await connect();
  return {
    ...db,
    connectSibling: connect,
    close: async () => {
      await db.close();
      await admin.query(`DROP DATABASE ${database}`);
      await admin.end();
    },
  };
}
