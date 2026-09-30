/**
 * Checks that the database in DATABASE_URL can be reached (e.g. from the
 * Plesk server to Supabase) and prints the server version.
 *   DATABASE_URL='…' npm run db:check
 */
require("dotenv").config();
const prisma = require("../db");

const timer = setTimeout(() => {
  console.error("No answer after 15 s - is outgoing traffic to the database port (5432/6543) allowed from this server?");
  process.exit(1);
}, 15000);

prisma
  .$queryRawUnsafe("SELECT version() AS v")
  .then((rows) => console.log("Database reachable:", String(rows[0].v).split(",")[0]))
  .catch((err) => {
    console.error("Database NOT reachable:", (err.message || String(err)).split("\n").filter(Boolean).slice(-1)[0]);
    process.exitCode = 1;
  })
  .finally(async () => {
    clearTimeout(timer);
    await prisma.$disconnect();
  });
