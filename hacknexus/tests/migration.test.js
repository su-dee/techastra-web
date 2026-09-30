import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
test("optional-domain migration preserves existing data and can run again", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "CREATE TABLE registrations (team_name TEXT, domain VARCHAR(10) NOT NULL, problem_id VARCHAR(20), CHECK (problem_id IS NULL OR domain='HN-AI')); INSERT INTO registrations VALUES ('Existing Squad','HN-AI','HN-AI-01');",
    );
    const sql = await readFile(
      new URL("../server/migrations/002_optional_domain.sql", import.meta.url),
      "utf8",
    );
    await db.exec(sql);
    await db.exec(sql);
    const existing = await db.query(
      "SELECT * FROM registrations WHERE team_name='Existing Squad'",
    );
    assert.equal(existing.rows[0].problem_id, "HN-AI-01");
    await db.query(
      "INSERT INTO registrations VALUES ('Undecided Squad',NULL,NULL)",
    );
    await assert.rejects(
      db.query(
        "INSERT INTO registrations VALUES ('  EXISTING   SQUAD  ',NULL,NULL)",
      ),
      { code: "23505" },
    );
  } finally {
    await db.close();
  }
});
