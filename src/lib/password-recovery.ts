import "server-only";
import { randomBytes, createHash } from "crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { encryptAtRest, decryptAtRest } from "@/lib/message-crypto";

// Password recovery without email or OTP: signup issues these codes once, and
// any unused one resets the password on /forgot-password. Same shape as the
// 2FA recovery codes in two-factor.ts (10 codes, sha256-hashed at rest — a
// code has ~60 bits of entropy, so the hash only defends against a raw DB
// leak being replayable, not brute force; the reset action is rate-limited
// per IP and per identifier for that), but a separate table — see
// PasswordRecoveryCode's comment in schema.prisma.

const CODE_COUNT = 10;

function hashCode(code: string): string {
  return createHash("sha256").update(normalizeCode(code)).digest("hex");
}

// Codes are shown as "xxxx-xxxx-xxxx" (lowercase base32-ish alphabet, no
// ambiguous 0/o/1/l) so they're easy to write down and type back; input is
// normalized so case and missing/extra dashes or spaces don't matter.
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

function normalizeCode(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function randomCode(): string {
  const bytes = randomBytes(12);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

// Replaces every existing code for the user — a regenerated set always
// invalidates the previous one, so a stale printout can't be used.
export async function issuePasswordRecoveryCodes(
  userId: string,
  client: Prisma.TransactionClient | typeof db = db,
): Promise<string[]> {
  const codes = Array.from({ length: CODE_COUNT }, randomCode);
  await client.passwordRecoveryCode.deleteMany({ where: { userId } });
  await client.passwordRecoveryCode.createMany({
    data: codes.map((code) => ({ userId, codeHash: hashCode(code) })),
  });
  return codes;
}

// Atomically claims one unused code belonging to this user. Returns false for
// wrong, used, or someone-else's code alike — no signal about which. The
// conditional updateMany (usedAt: null) means two concurrent resets with the
// same code can't both succeed.
export async function consumePasswordRecoveryCode(
  userId: string,
  code: string,
  client: Prisma.TransactionClient | typeof db = db,
): Promise<boolean> {
  if (!normalizeCode(code)) return false;
  const { count } = await client.passwordRecoveryCode.updateMany({
    where: { userId, codeHash: hashCode(code), usedAt: null },
    data: { usedAt: new Date() },
  });
  return count === 1;
}

export async function countUnusedPasswordRecoveryCodes(userId: string): Promise<number> {
  return db.passwordRecoveryCode.count({ where: { userId, usedAt: null } });
}

// Carries freshly issued codes from signup() to the one-time
// /signup/recovery-codes page. A cookie rather than returning them from the
// action because signup() also sets the session cookie, which re-renders the
// route and would drop client state. Encrypted with the same at-rest key as
// DMs so the codes never sit in the browser in plaintext, httpOnly, and short
// lived — acknowledgeRecoveryCodes() deletes it as soon as the user continues.
export const RECOVERY_CODES_COOKIE = "0dot_recovery_codes";
export const RECOVERY_CODES_COOKIE_MAX_AGE_S = 15 * 60;

export function sealRecoveryCodes(userId: string, codes: string[]): string {
  return encryptAtRest(JSON.stringify({ userId, codes }));
}

export function unsealRecoveryCodes(sealed: string, userId: string): string[] | null {
  try {
    const parsed = JSON.parse(decryptAtRest(sealed)) as { userId?: string; codes?: unknown };
    if (parsed.userId !== userId || !Array.isArray(parsed.codes)) return null;
    return parsed.codes.filter((c): c is string => typeof c === "string");
  } catch {
    return null;
  }
}
