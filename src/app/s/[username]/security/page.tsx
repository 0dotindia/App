import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { countUnusedPasswordRecoveryCodes } from "@/lib/password-recovery";
import { ChangePasswordForm } from "../ChangePasswordForm";
import { RegeneratePasswordRecoveryCodesForm } from "./RegeneratePasswordRecoveryCodesForm";

export const metadata: Metadata = { title: "Change password" };

export default async function SecuritySettingsPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  const unusedRecoveryCodes = await countUnusedPasswordRecoveryCodes(currentUser.id);

  return (
    <div className="settingsSection">
      <h2 className="settingsSectionHeading">Change password</h2>
      <p className="mutedText" style={{ marginBottom: "1rem" }}>
        Choose a strong, unique password. Changing it signs you out of every other device.
      </p>
      <ChangePasswordForm />

      <h2 className="settingsSectionHeading" style={{ marginTop: "2rem" }}>Password recovery codes</h2>
      <p className="mutedText" style={{ marginBottom: "1rem" }}>
        If you forget your password, reset it with your username and one of these codes.{" "}
        {unusedRecoveryCodes > 0
          ? `You have ${unusedRecoveryCodes} unused ${unusedRecoveryCodes === 1 ? "code" : "codes"}.`
          : "You don't have any unused codes — generate a set now so you can't get locked out."}{" "}
        Generating a new set replaces the old one.
      </p>
      <RegeneratePasswordRecoveryCodesForm />
    </div>
  );
}
