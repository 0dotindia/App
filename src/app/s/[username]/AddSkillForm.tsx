"use client";

import { useActionState, useRef } from "react";
import { addSkill } from "@/app/actions/skills";
import { useResetOnSuccess } from "@/hooks/useResetOnSuccess";

export function AddSkillForm() {
  const [state, formAction, pending] = useActionState(addSkill, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useResetOnSuccess(formRef, pending, state);

  return (
    <form
      ref={formRef}
      action={formAction}
      style={{ display: "flex", gap: "0.4rem", alignItems: "flex-end" }}
    >
      <div className="field">
        <label htmlFor="skillName">Skill</label>
        <input id="skillName" name="name" maxLength={40} required className="textInput" />
      </div>
      <button type="submit" className="button buttonSecondary buttonSmall" disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </button>
      {state?.error && (
        <p className="errorText" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
