import "server-only";
import { db } from "@/lib/db";

// Admin tools name a target account by email or username ("@alice" or
// "alice"). Email alone stopped being enough once signup made it optional —
// most new accounts only have a username.
export async function findUserForAdmin(identifierRaw: string) {
  const identifier = identifierRaw.trim().toLowerCase();
  if (!identifier) return null;
  if (identifier.includes("@") && !identifier.startsWith("@")) {
    return db.user.findUnique({ where: { email: identifier }, include: { username: true } });
  }
  const handle = identifier.replace(/^@/, "");
  const username = await db.username.findUnique({ where: { handle } });
  return username ? db.user.findUnique({ where: { id: username.userId }, include: { username: true } }) : null;
}
