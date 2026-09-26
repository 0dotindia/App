import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { ROLE_VALUES } from "../src/lib/platform-roles";

// One-time bootstrap for the very first PlatformRole row(s). Every
// subsequent grant should go through /admin/platform-roles (requires an
// existing super_admin — see requirePlatformRole in src/lib/auth-guards.ts),
// since that path has an audit trail (grantedBy) and this one doesn't.
//
// Usage: HANDLE=alice [ROLE=super_admin|admin|support] [PHONE=+91...] npx tsx scripts/grant-super-admin.ts
//    or: EMAIL=someone@example.com ...   (only for accounts that have an email —
//        signup no longer collects one, so most new accounts need HANDLE). Not
//        USERNAME: many shells pre-set $USERNAME to the OS login name.

async function main() {
  const handle = process.env.HANDLE?.trim().toLowerCase().replace(/^@/, "");
  const email = process.env.EMAIL?.trim().toLowerCase();
  if (!handle && !email) throw new Error("Set HANDLE=alice (or EMAIL=someone@example.com)");
  const target = handle ? `@${handle}` : email!;
  const role = process.env.ROLE?.trim() || "super_admin";
  if (!ROLE_VALUES.has(role)) throw new Error(`ROLE must be one of: ${[...ROLE_VALUES].join(", ")}`);
  const phone = process.env.PHONE?.trim();

  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  console.log(`Granting ${role} to "${target}" at: ${url}`);

  const adapter = new PrismaLibSql({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  const prisma = new PrismaClient({ adapter });
  try {
    const user = handle
      ? (await prisma.username.findUnique({ where: { handle }, select: { user: { select: { id: true, email: true } } } }))?.user
      : await prisma.user.findUnique({ where: { email: email! }, select: { id: true, email: true } });
    if (!user) throw new Error(`No 0dot account exists for "${target}" yet — they must sign up first.`);

    const granted = await prisma.platformRole.upsert({
      where: { userId: user.id },
      create: { userId: user.id, role, grantedBy: null },
      update: { role, grantedBy: null, grantedAt: new Date() },
    });
    console.log(`Done: ${target} (${user.id}) is now ${role} (grantedAt: ${granted.grantedAt.toISOString()})`);

    if (phone) {
      await prisma.user.update({ where: { id: user.id }, data: { phone } });
      console.log(`Also set phone to ${phone}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("FAILED:", err.message ?? err);
  process.exitCode = 1;
});
