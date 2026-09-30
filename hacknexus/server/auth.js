import { scrypt, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt);
export function normalizeMobile(value) {
  if (typeof value !== "string" || !/^\+?[\d ()-]+$/.test(value)) return null;
  const digits = value.replace(/\D/g, "");
  return /^\d{10,15}$/.test(digits) ? digits : null;
}
// Returns why a new password is not acceptable, or null when it is.
export function passwordProblem(password, username) {
  if (typeof password !== "string" || password.length < 8)
    return "Use a password of at least 8 characters.";
  if (password.length > 128) return "Use a password of at most 128 characters.";
  if (normalizeMobile(password))
    return "Don’t use a phone number as your password.";
  if (password.trim().toLowerCase() === username)
    return "Your password can’t be your username.";
  return null;
}
// The value to check against the stored hash. Accounts created before chosen
// passwords existed use their mobile number, stored as digits only.
export function passwordCandidate(password, kind) {
  if (typeof password !== "string" || !password || password.length > 128)
    return null;
  return kind === "mobile" ? normalizeMobile(password) : password;
}
export async function hashPassword(value) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(value, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt:${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(value, hash) {
  const [algorithm, salt, expected] = hash.split(":");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const key = await derive(value, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  const stored = Buffer.from(expected, "hex");
  return stored.length === key.length && timingSafeEqual(key, stored);
}
export const tokenHash = (token) =>
  createHash("sha256").update(token).digest("hex");
