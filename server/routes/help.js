const express = require("express");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { isEmail } = require("../utils/validation");

const router = express.Router();

/** POST /api/help - public help desk query submission. */
router.post("/", async (req, res) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const message = String(req.body?.message ?? "").trim();
    if (!name || !email || !message) {
      return res.status(400).json({ error: "name, email and message are required" });
    }
    if (name.length > 100 || email.length > 254 || message.length > 2000 || !isEmail(email)) {
      return res.status(400).json({ error: "Please enter a valid email and keep the message under 2000 characters." });
    }
    const query = await prisma.helpQuery.create({ data: { name, email, message } });
    res.status(201).json({ query });
  } catch (err) {
    console.error("Submit help query error:", err);
    res.status(500).json({ error: "Failed to submit query" });
  }
});

/** GET /api/help - master_admin: view all queries. */
router.get("/", requireAuth, requireRole("master_admin"), async (req, res) => {
  try {
    const queries = await prisma.helpQuery.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ queries });
  } catch (err) {
    console.error("List help queries error:", err);
    res.status(500).json({ error: "Failed to load queries" });
  }
});

/** PATCH /api/help/:id/resolve - master_admin: mark resolved. */
router.patch("/:id/resolve", requireAuth, requireRole("master_admin"), async (req, res) => {
  try {
    const query = await prisma.helpQuery.update({ where: { id: req.params.id }, data: { status: "resolved" } });
    res.json({ query });
  } catch (err) {
    console.error("Resolve help query error:", err);
    res.status(500).json({ error: "Failed to update query" });
  }
});

/** PATCH /api/help/:id/reopen - master_admin: mark a resolved query open again. */
router.patch("/:id/reopen", requireAuth, requireRole("master_admin"), async (req, res) => {
  try {
    const query = await prisma.helpQuery.update({ where: { id: req.params.id }, data: { status: "open" } });
    res.json({ query });
  } catch (err) {
    console.error("Reopen help query error:", err);
    res.status(500).json({ error: "Failed to update query" });
  }
});

module.exports = router;
