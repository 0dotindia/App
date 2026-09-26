import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { login, signup, recoverPassword } from "@/app/actions/auth";
import { db } from "@/lib/db";
import { createUser } from "@/test/factories";
import { cookieJar, headerJar, redirectState, NextRedirectSignal } from "@/test/next-test-state";
import { issuePasswordRecoveryCodes, RECOVERY_CODES_COOKIE, unsealRecoveryCodes } from "@/lib/password-recovery";

const PASSWORD = "correct-horse-battery-staple";

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

// Regression coverage for BUGS.md #1 ("Login doesn't check account status")
// and #2/#10 ("User-enumeration timing side-channel").
describe("login", () => {
  it("rejects a suspended account even with the correct password", async () => {
    headerJar.set("x-forwarded-for", "10.0.0.1");
    const user = await createUser({ status: "suspended" });
    const result = await login(undefined, formData({ identifier: user.email!, password: PASSWORD }));
    expect(result?.error).toBe("This account is no longer active.");
  });

  it("returns the same generic error for a nonexistent email as for a wrong password", async () => {
    headerJar.set("x-forwarded-for", "10.0.0.2");
    const existing = await createUser();
    const wrongPassword = await login(undefined, formData({ identifier: existing.email!, password: "wrong-password" }));

    headerJar.set("x-forwarded-for", "10.0.0.3");
    const noSuchUser = await login(undefined, formData({ identifier: "nobody-here@example.com", password: "wrong-password" }));

    expect(wrongPassword?.error).toBe("Incorrect username or password.");
    expect(noSuchUser?.error).toBe(wrongPassword?.error);
  });

  // 11 sequential logins, each firing two enforceRateLimit() calls against
  // the durable (RateLimitCounter/SQLite) tier — ~66 serialized writes plus
  // bcrypt. That runs well past vitest's 5s default on a loaded machine even
  // though the logic is fine, so this one test gets explicit headroom. (In
  // production the Redis tier makes this path a single round trip.)
  it("rate-limits repeated attempts from the same IP", async () => {
    headerJar.set("x-forwarded-for", "10.0.0.4");
    for (let i = 0; i < 10; i++) {
      await login(undefined, formData({ identifier: `nope-${i}@example.com`, password: "x" }));
    }
    const blocked = await login(undefined, formData({ identifier: "nope-final@example.com", password: "x" }));
    expect(blocked?.error).toMatch(/too many attempts/i);
  }, 20_000);
});

async function expectRedirect(action: Promise<unknown>): Promise<string> {
  await expect(action).rejects.toBeInstanceOf(NextRedirectSignal);
  return redirectState.url!;
}

// Signup has no email/OTP verification step: name + username + password,
// logged in immediately, then shown one-time password recovery codes.
describe("signup", () => {
  it("creates an account with no email, signs in, and hands off recovery codes", async () => {
    headerJar.set("x-forwarded-for", "10.0.1.1");
    const url = await expectRedirect(
      signup(undefined, formData({ displayName: "New Person", username: "newperson_1", password: PASSWORD })),
    );
    expect(url).toBe("/signup/recovery-codes");

    const handle = await db.username.findUnique({ where: { handle: "newperson_1" }, include: { user: true } });
    expect(handle?.user.email).toBeNull();
    expect(handle?.user.emailVerifiedAt).toBeNull();
    expect(cookieJar.get("0dot_session")).toBeTruthy();

    const codes = unsealRecoveryCodes(cookieJar.get(RECOVERY_CODES_COOKIE)!, handle!.userId);
    expect(codes).toHaveLength(10);
    expect(await db.passwordRecoveryCode.count({ where: { userId: handle!.userId, usedAt: null } })).toBe(10);
  });

  it("rejects a username that's already taken", async () => {
    headerJar.set("x-forwarded-for", "10.0.1.2");
    await expectRedirect(signup(undefined, formData({ displayName: "Original", username: "taken_name", password: PASSWORD })));
    const result = await signup(
      undefined,
      formData({ displayName: "Copycat", username: "taken_name", password: PASSWORD }),
    );
    expect(result?.error).toBe("That username is already taken.");
  });

  it("lets a new account log in straight to the feed with no verification detour", async () => {
    // Digits in the username must not be mistaken for a phone number.
    headerJar.set("x-forwarded-for", "10.0.1.3");
    await expectRedirect(signup(undefined, formData({ displayName: "Direct", username: "direct1234567", password: PASSWORD })));
    cookieJar.clear();

    headerJar.set("x-forwarded-for", "10.0.1.4");
    const url = await expectRedirect(login(undefined, formData({ identifier: "direct1234567", password: PASSWORD })));
    expect(url).toBe("/feed");
  });
});

describe("recoverPassword", () => {
  it("resets the password with a valid code, and the code only works once", async () => {
    headerJar.set("x-forwarded-for", "10.0.2.1");
    const user = await createUser();
    const [code] = await issuePasswordRecoveryCodes(user.id);
    const fields = { identifier: user.username!.handle, recoveryCode: code.toUpperCase(), password: "brand-new-password", confirmPassword: "brand-new-password" };

    expect(await expectRedirect(recoverPassword(undefined, formData(fields)))).toBe("/reset-password/success");
    const updated = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await bcrypt.compare("brand-new-password", updated.passwordHash)).toBe(true);

    headerJar.set("x-forwarded-for", "10.0.2.2");
    const replay = await recoverPassword(undefined, formData(fields));
    expect(replay?.error).toMatch(/don't match/);
  });

  it("rejects another account's code with the same generic error as a wrong one", async () => {
    headerJar.set("x-forwarded-for", "10.0.2.3");
    const victim = await createUser();
    const attacker = await createUser();
    const [attackerCode] = await issuePasswordRecoveryCodes(attacker.id);
    const result = await recoverPassword(
      undefined,
      formData({ identifier: victim.username!.handle, recoveryCode: attackerCode, password: "hijacked-pass", confirmPassword: "hijacked-pass" }),
    );
    expect(result?.error).toMatch(/don't match/);
    const unchanged = await db.user.findUniqueOrThrow({ where: { id: victim.id } });
    expect(await bcrypt.compare(PASSWORD, unchanged.passwordHash)).toBe(true);
  });
});
