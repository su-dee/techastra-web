/**
 * Rate limiting middleware to prevent brute-force attacks and abuse.
 * Implements a simple in-memory store (for production, use Redis).
 */

const rateStore = new Map();

// Clean up old entries every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateStore.entries()) {
    if (now - data.resetTime > 0) {
      rateStore.delete(key);
    }
  }
}, 15 * 60 * 1000).unref(); // don't keep the process alive (tests, shutdown)

/**
 * Creates a rate limiter middleware.
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum requests per window
 * @param {string} options.message - Error message when limit exceeded
 * @param {Function} options.keyGenerator - Function to generate rate limit key
 */
function createRateLimiter({
  windowMs = 15 * 60 * 1000, // 15 minutes default
  max = 100,
  message = "Too many requests, please try again later",
  keyGenerator = (req) => req.ip || req.connection.remoteAddress,
  skipSuccessfulRequests = false,
  handler = null,
} = {}) {
  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();

    if (!rateStore.has(key)) {
      rateStore.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      return next();
    }

    const data = rateStore.get(key);

    // Reset if window expired
    if (now > data.resetTime) {
      data.count = 1;
      data.resetTime = now + windowMs;
      rateStore.set(key, data);
      return next();
    }

    // Increment counter
    data.count++;
    rateStore.set(key, data);

    // Check if limit exceeded
    if (data.count > max) {
      const retryAfter = Math.ceil((data.resetTime - now) / 1000);
      res.set("Retry-After", String(retryAfter));
      res.set("X-RateLimit-Limit", String(max));
      res.set("X-RateLimit-Remaining", "0");
      res.set("X-RateLimit-Reset", String(data.resetTime));

      if (handler) {
        return handler(req, res);
      }

      return res.status(429).json({
        error: message,
        retryAfter: retryAfter,
      });
    }

    // Add rate limit headers
    res.set("X-RateLimit-Limit", String(max));
    res.set("X-RateLimit-Remaining", String(max - data.count));
    res.set("X-RateLimit-Reset", String(data.resetTime));

    // Skip incrementing on successful requests if configured
    if (skipSuccessfulRequests) {
      const originalJson = res.json.bind(res);
      res.json = function (body) {
        if (res.statusCode < 400) {
          data.count--;
          rateStore.set(key, data);
        }
        return originalJson(body);
      };
    }

    next();
  };
}

// Strict rate limiter for authentication endpoints (prevents brute-force)
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes per IP
  message: "Too many login attempts. Please try again in 15 minutes.",
  skipSuccessfulRequests: true, // Only failed logins count
  keyGenerator: (req) => {
    // Rate limit by IP + email to prevent targeted attacks
    const ip = req.ip || req.connection.remoteAddress;
    const email = req.body?.email?.toLowerCase().trim() || "unknown";
    return `login:${ip}:${email}`;
  },
});

// Registration spam protection, in two layers. Whole college labs and
// hostels register from behind one shared IP (NAT), so the per-IP cap is
// generous; the per-email cap is the tight one. The email limiter runs after
// multer has parsed the multipart body, so req.body.email is available.
const registrationIpLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 60,
  message: "Too many registrations from this network. Please try again later.",
  keyGenerator: (req) => `registration-ip:${req.ip || req.connection.remoteAddress}`,
});
const registrationEmailLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: "Too many registration attempts for this email. Please try again in an hour.",
  keyGenerator: (req) => `registration-email:${String(req.body?.email || "").toLowerCase().trim()}`,
});

// Rate limiter for QR scanning (prevents abuse)
const scanLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 scans per minute per coordinator
  message: "Too many scan attempts. Please slow down.",
  keyGenerator: (req) => {
    // Rate limit by user ID (coordinator)
    return `scan:${req.user?.id || req.ip}`;
  },
});

// General API rate limiter (prevents abuse)
const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes per IP
  message: "Too many requests from this IP. Please try again later.",
});

// Public status check: generous for shared college/venue Wi-Fi, but stops
// anyone scripting through registration codes.
const statusLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: "Too many status checks from this network. Please try again in a few minutes.",
  keyGenerator: (req) => `status:${req.ip || req.connection.remoteAddress}`,
});

// Strict limiter for export/download endpoints
const exportLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 exports per hour per user
  message: "Too many export requests. Please try again later.",
  keyGenerator: (req) => {
    return `export:${req.user?.id || req.ip}`;
  },
});

// Coarse flood protection for the whole API. Deliberately loose: on event
// day hundreds of phones share the venue Wi-Fi's single public IP.
const globalLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 3000,
  message: "Too many requests from this network. Please slow down.",
  keyGenerator: (req) => `global:${req.ip || req.connection.remoteAddress}`,
});

module.exports = {
  createRateLimiter,
  loginLimiter,
  registrationIpLimiter,
  registrationEmailLimiter,
  globalLimiter,
  scanLimiter,
  apiLimiter,
  exportLimiter,
  statusLimiter,
};
