import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { issueRecoveryCodesForUser } from "@/app/actions/admin-account-recovery";
import { consumePasswordRecoveryCode, issuePasswordRecoveryCodes } from "@/lib/password-recovery";
import { createUser, createSessionForUser } from "@/test/factories";
import { setSessionCookie, NextRedirectSignal } from "@/test/next-test-state";

function formData(identifier: string) {
  const fd = new FormData();
  fd.set("identifier", identifier);
  return fd;
}

async function signInAs(userId: string, role?: string) {
  if (role) await db.platformRole.create({ data: { userId, role } });
  setSessionCookie(await createSessionForUser(userId));
}

describe("issueRecoveryCodesForUser", () => {
  it("lets an admin replace a user's recovery codes by @username", async () => {
    const admin = await createUser();
    await signInAs(admin.id, "admin");
    const target = await createUser();
    const [oldCode] = await issuePasswordRecoveryCodes(target.id);

    const result = await issueRecoveryCodesForUser(undefined, formData(`@${target.username!.handle}`));
    expect(result?.codes).toHaveLength(10);
    expect(await consumePasswordRecoveryCode(target.id, oldCode)).toBe(false);
    expect(await consumePasswordRecoveryCode(target.id, result!.codes![0])).toBe(true);
  });

  it("is refused below the admin role", async () => {
    const supportStaff = await createUser();
    await signInAs(supportStaff.id, "support");
    const target = await createUser();
    await expect(issueRecoveryCodesForUser(undefined, formData(target.username!.handle))).rejects.toBeInstanceOf(NextRedirectSignal);
    expect(await db.passwordRecoveryCode.count({ where: { userId: target.id } })).toBe(0);
  });
});
