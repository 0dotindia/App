"use client";

import { useActionState } from "react";
import { createLearningPath, updateLearningPath } from "@/app/actions/learning-paths";
import { OrderedPicker } from "@/components/OrderedPicker";

type LearningPathFormPath = { id: string; title: string; courseIds: string[] };

// Mirrors ProjectForm.tsx: branch on the presence of the entity prop to
// pick create vs. update — previously there was no edit path at all here.
export function LearningPathForm({
  courses,
  path,
}: {
  courses: { id: string; title: string }[];
  path?: LearningPathFormPath;
}) {
  const action = path ? updateLearningPath : createLearningPath;
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="settingsForm">
      {path && <input type="hidden" name="pathId" value={path.id} />}
      <input
        name="title"
        placeholder="Learning path title"
        defaultValue={path?.title}
        required
        maxLength={160}
        className="textInput"
      />
      <p className="mutedText" style={{ fontSize: "0.85rem", margin: 0 }}>Courses, in order:</p>
      <OrderedPicker
        name="courseIds"
        options={courses.map((c) => ({ id: c.id, label: c.title }))}
        initialSelectedIds={path?.courseIds ?? []}
      />
      <button type="submit" className="button" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Saving…" : path ? "Save changes" : "Create learning path"}
      </button>
      {state?.error && <p className="errorText">{state.error}</p>}
    </form>
  );
}
