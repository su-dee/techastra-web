const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../db");
const { requireAuth } = require("../middleware/auth");
const { loginLimiter } = require("../middleware/rateLimiter");
const { logFailedAuth, logSecurityEvent } = require("../middleware/securityLogger");

const router = express.Router();

/**
 * POST /api/auth/login
 * All roles log in through this single endpoint using email + password.
 * Participants are only allowed to log in once their registration is approved.
 * Rate limited to prevent brute-force attacks: 5 attempts per 15 minutes per IP+email.
 */
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { registration: true },
    });

    if (!user) {
      logFailedAuth(req, normalizedEmail, "user_not_found");
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      logFailedAuth(req, normalizedEmail, "invalid_password");
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (user.role === "participant") {
      if (!user.registration || user.registration.status !== "approved") {
        logFailedAuth(req, normalizedEmail, "registration_not_approved");
        return res.status(403).json({
          error: "Your registration is not approved yet. Please check your status page.",
        });
      }
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        name: user.name,
        assignedEventId: user.assignedEventId || null,
      },
      process.env.JWT_SECRET,
      // Staff sessions are short (a lost or shared staff device stops working
      // by the next day); participants stay signed in longer.
      {
        expiresIn:
          user.role === "participant"
            ? process.env.JWT_EXPIRES_IN || "7d"
            : process.env.STAFF_JWT_EXPIRES_IN || "12h",
      }
    );

    // Log successful login
    logSecurityEvent("SUCCESSFUL_LOGIN", {
      ip: req.ip || req.connection.remoteAddress,
      userId: user.id,
      email: user.email,
      role: user.role,
      userAgent: req.headers["user-agent"],
    });

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        collegeName: user.collegeName,
        registerNo: user.registerNo,
        assignedEventId: user.assignedEventId,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Something went wrong during login" });
  }
});

/** GET /api/auth/me - returns the current logged in user's profile. */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const { passwordHash, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (err) {
    console.error("Fetch me error:", err);
    res.status(500).json({ error: "Failed to load profile" });
  }
});

module.exports = router;
