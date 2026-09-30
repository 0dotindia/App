"use client";

import { useOptimistic } from "react";
import { Repeat2 } from "lucide-react";
import { formatCount } from "@/lib/format";
import { toggleRepost } from "@/app/actions/posts";

// FIX_PLAN P3 #2: extracted from PostCard.tsx's plain, non-optimistic
// repost <form>, same shape as LikeButton.tsx — the repost count now
// updates the instant a user clicks instead of waiting for the Server
// Action's revalidatePath, and the button shows as pressed/toggled instead
// of never reflecting whether the viewer has already reposted.
export function RepostButton({
  postId,
  reposted,
  count,
}: {
  postId: string;
  reposted: boolean;
  count: number;
}) {
  const [optimistic, setOptimistic] = useOptimistic(
    { reposted, count },
    (state, nextReposted: boolean) => ({
      reposted: nextReposted,
      count: state.count + (nextReposted ? 1 : -1),
    })
  );

  return (
    <form
      action={async (formData: FormData) => {
        setOptimistic(!optimistic.reposted);
        await toggleRepost(formData);
      }}
    >
      <input type="hidden" name="postId" value={postId} />
      <button
        type="submit"
        className="postAction"
        aria-pressed={optimistic.reposted}
        aria-label={
          optimistic.count > 0
            ? `${optimistic.reposted ? "Undo repost" : "Repost"}, ${formatCount(optimistic.count)} repost${optimistic.count === 1 ? "" : "s"}`
            : optimistic.reposted
              ? "Undo repost"
              : "Repost"
        }
      >
        <Repeat2 size={16} aria-hidden="true" />
        {optimistic.count > 0 ? formatCount(optimistic.count) : "Repost"}
      </button>
    </form>
  );
}
