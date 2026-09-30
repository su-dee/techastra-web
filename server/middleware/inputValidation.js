/**
 * Input Validation Middleware
 * Sanitizes and validates user inputs to prevent injection attacks
 */

/**
 * Validates email format
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validates phone number (Indian format)
 */
function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  // Allow +91, 0, or direct 10-digit numbers
  const phoneRegex = /^(\+91)?[6-9]\d{9}$/;
  return phoneRegex.test(phone.replace(/[\s-]/g, ''));
}

/**
 * Validates registration code format
 */
function isValidRegistrationCode(code) {
  if (!code || typeof code !== 'string') return false;
  // Format: SYMYYYY-NNNN (e.g. SYM2026-0017) - see utils/codes.js
  const codeRegex = /^SYM\d{4}-\d{4,6}$/i;
  return codeRegex.test(code);
}

/**
 * Validates transaction ID format
 */
function isValidTransactionId(txnId) {
  if (!txnId || typeof txnId !== 'string') return false;
  // Allow alphanumeric, hyphens, underscores (common in payment gateways)
  // Length between 8 and 50 characters
  const txnRegex = /^[a-zA-Z0-9_-]{8,50}$/;
  return txnRegex.test(txnId);
}

/**
 * Validates UUID format
 */
function isValidUUID(id) {
  if (!id || typeof id !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Validates a database record id: Prisma's cuid (the ids this schema uses,
 * e.g. "cmuftoz8i000m117x8aeorz51") or a UUID.
 */
function isValidRecordId(id) {
  if (!id || typeof id !== 'string') return false;
  return /^c[a-z0-9]{20,32}$/.test(id) || isValidUUID(id);
}

/**
 * Sanitizes string input to prevent XSS
 */
function sanitizeString(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .slice(0, 500); // Limit length
}

/**
 * Validates object ID (UUID) parameter
 */
function validateIdParam(req, res, next) {
  const { id } = req.params;
  
  if (!isValidUUID(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  
  next();
}

/**
 * Validates registration data
 */
function validateRegistrationData(req, res, next) {
  const { email, phone, registerNo } = req.body;
  
  const errors = [];
  
  if (email && !isValidEmail(email)) {
    errors.push('Invalid email format');
  }
  
  if (phone && !isValidPhone(phone)) {
    errors.push('Invalid phone number format');
  }
  
  if (registerNo && typeof registerNo === 'string') {
    // Sanitize registerNo to prevent injection
    req.body.registerNo = sanitizeString(registerNo);
  }
  
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  
  next();
}

/**
 * Validates payment data
 */
function validatePaymentData(req, res, next) {
  const { transactionId, totalAmount } = req.body;
  
  const errors = [];
  
  if (transactionId && !isValidTransactionId(transactionId)) {
    errors.push('Invalid transaction ID format');
  }
  
  if (totalAmount !== undefined) {
    const amount = Number(totalAmount);
    if (isNaN(amount) || amount < 0 || amount > 100000) {
      errors.push('Invalid amount (must be between 0 and 100000)');
    }
  }
  
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  
  next();
}

/**
 * Validates QR code scan data
 */
function validateQRScanData(req, res, next) {
  const { registrationCode, eventId } = req.body;
  
  const errors = [];
  
  if (!registrationCode || !isValidRegistrationCode(registrationCode)) {
    errors.push('Invalid registration code format');
  }
  
  if (eventId && !isValidRecordId(eventId)) {
    errors.push('Invalid event ID format');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  
  next();
}

/**
 * Validates meal session data
 */
function validateMealSessionData(req, res, next) {
  const { registrationCode, mealSession } = req.body;
  
  const errors = [];
  const validSessions = ['breakfast', 'lunch', 'snacks'];
  
  if (!registrationCode || !isValidRegistrationCode(registrationCode)) {
    errors.push('Invalid registration code format');
  }
  
  if (!mealSession || !validSessions.includes(mealSession)) {
    errors.push(`mealSession must be one of: ${validSessions.join(', ')}`);
  }
  
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  
  next();
}

/**
 * Sanitizes search query parameters
 */
function sanitizeSearchQuery(req, res, next) {
  const { q, search, query } = req.query;
  
  if (q) req.query.q = sanitizeString(q);
  if (search) req.query.search = sanitizeString(search);
  if (query) req.query.query = sanitizeString(query);
  
  next();
}

module.exports = {
  isValidEmail,
  isValidPhone,
  isValidRegistrationCode,
  isValidTransactionId,
  isValidUUID,
  sanitizeString,
  validateIdParam,
  validateRegistrationData,
  validatePaymentData,
  validateQRScanData,
  validateMealSessionData,
  sanitizeSearchQuery,
};
