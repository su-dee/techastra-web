const jwt = require("jsonwebtoken");
const prisma = require("../db");

/**
 * Loads the account behind a verified token. The role and assigned event
 * always come from the database, never from the token, so deleting an account
 * or changing someone's role takes effect on their very next request (a token
 * alone is only proof of who they are, not of what they may do).
 */
async function currentUser(decoded) {
  if (!decoded?.id) return null;
  return prisma.user.findUnique({
    where: { id: decoded.id },
    select: { id: true, name: true, role: true, assignedEventId: true },
  });
}

function bearer(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

/**
 * Verifies the Authorization: Bearer <token> header and attaches the live
 * account ({ id, name, role, assignedEventId }) to req.user.
 */
async function requireAuth(req, res, next) {
  const token = bearer(req);
  if (!token) {
    return res.status(401).json({ error: "Missing authentication token" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  try {
    const user = await currentUser(decoded);
    if (!user) {
      return res.status(401).json({ error: "This account no longer exists. Please sign in again." });
    }
    req.user = user;
    next();
  } catch (err) {
    console.error("Auth lookup error:", err);
    res.status(503).json({ error: "Couldn't verify your session. Please try again." });
  }
}

/**
 * Restricts a route to one or more roles. Must be used after requireAuth.
 * Usage: requireRole("master_admin", "coordinator")
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions for this action" });
    }
    next();
  };
}

/**
 * Optional auth - attaches the live account if a valid token is present but
 * never rejects the request. For public endpoints that differ when logged in.
 */
async function optionalAuth(req, res, next) {
  const token = bearer(req);
  if (!token) return next();
  try {
    const user = await currentUser(jwt.verify(token, process.env.JWT_SECRET));
    if (user) req.user = user;
  } catch (err) {
    // ignore invalid tokens on optional routes
  }
  next();
}

module.exports = { requireAuth, requireRole, optionalAuth };
