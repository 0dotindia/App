"use client";

import { useActionState } from "react";
import { grantPlatformRole } from "@/app/actions/platform-roles";

export function GrantRoleForm() {
  const [state, formAction, pending] = useActionState(grantPlatformRole, undefined);

  return (
    <form action={formAction} className="authCard" style={{ maxWidth: "none" }}>
      <div className="field">
        <label htmlFor="identifier">Username or email</label>
        <input id="identifier" name="identifier" type="text" autoCapitalize="none" spellCheck={false} placeholder="@username" required />
        <span className="mutedText">Must already have a 0dot account.</span>
      </div>
      <div className="field">
        <label htmlFor="role">Role</label>
        <select id="role" name="role" className="textInput" defaultValue="support">
          <option value="support">Support</option>
          <option value="admin">Admin</option>
          <option value="super_admin">Super admin</option>
        </select>
      </div>
      {state?.error && <p className="errorText">{state.error}</p>}
      <button type="submit" className="button buttonSecondary buttonSmall" disabled={pending}>
        {pending ? "Granting…" : "Grant role"}
      </button>
    </form>
  );
}
