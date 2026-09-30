import pg from "pg";
export const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 3000,
  max: 10,
});
db.on("error", (error) =>
  console.error("Database connection error:", error.code),
);
