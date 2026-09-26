import type { Metadata } from "next";
import { requirePlatformRole } from "@/lib/auth-guards";
import { AccountRecoveryForm } from "./AccountRecoveryForm";

export const metadata: Metadata = { title: "Account recovery" };

export default async function AdminAccountRecoveryPage() {
  await requirePlatformRole("admin");

  return (
    <div className="profileCard">
      <h1 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.75rem" }}>Account recovery</h1>
      <p className="mutedText" style={{ marginBottom: "1.25rem" }}>
        For a user who forgot their password and lost their recovery codes. Confirm who they are
        first, then issue a new set of codes and give them to the user privately — they reset
        their own password at /forgot-password. This replaces any codes they had before.
      </p>
      <AccountRecoveryForm />
    </div>
  );
}
