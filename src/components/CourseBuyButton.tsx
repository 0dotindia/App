"use client";

import { useActionState } from "react";
import { purchaseCourse } from "@/app/actions/courses";
import { formatCoins } from "@/lib/coins";

export function CourseBuyButton({
  courseId,
  price,
  viewerCoins,
}: {
  courseId: string;
  price: number;
  viewerCoins: number;
}) {
  const [state, formAction, pending] = useActionState(purchaseCourse, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="courseId" value={courseId} />
      {state?.error && <p className="errorText" style={{ margin: "0.2rem 0" }}>{state.error}</p>}
      {state?.success && <p className="mutedText" style={{ margin: "0.2rem 0", fontSize: "0.85rem" }}>You now have access.</p>}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          type="submit"
          className="button"
          disabled={pending || viewerCoins < price}
        >
          {pending ? "Buying…" : formatCoins(price)}
        </button>
      </div>
      {viewerCoins < price && (
        <p className="mutedText" style={{ margin: "0.2rem 0", fontSize: "0.8rem" }}>You have {formatCoins(viewerCoins)} of {formatCoins(price)}.</p>
      )}
    </form>
  );
}
