"use client";

import type { CSSProperties } from "react";
import { followUser, unfollowUser } from "@/app/actions/follow";
import { useToast } from "@/components/Toast";

// Small client island (same posture as LikeButton.tsx, extracted from
// PostCard) wrapping the plain <form action={...}> follow/unfollow pattern —
// shared by the profile header's own Follow button ([username]/page.tsx) and
// UserListItem.tsx's rail/list rows, which previously duplicated this same
// markup independently. The one thing a plain form couldn't do: an "Undo"
// toast on unfollow (Toast.tsx's action-button support), which needs a
// client-side hook into the submit.
export function FollowButton({
  userId,
  isFollowing,
  isFollowRequestPending = false,
  compact = false,
  className,
  style,
}: {
  userId: string;
  isFollowing: boolean;
  isFollowRequestPending?: boolean;
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const showToast = useToast();
  const wasFollowing = isFollowing || isFollowRequestPending;

  return (
    <form
      action={async (formData: FormData) => {
        if (wasFollowing) {
          await unfollowUser(formData);
          showToast("Unfollowed.", {
            label: "Undo",
            onClick: () => {
              const redo = new FormData();
              redo.set("followeeId", userId);
              void followUser(redo);
            },
          });
        } else {
          await followUser(formData);
        }
      }}
    >
      <input type="hidden" name="followeeId" value={userId} />
      <button
        type="submit"
        className={`button${wasFollowing ? " buttonSecondary" : ""}${compact ? " buttonSmall" : ""}${className ? ` ${className}` : ""}`}
        aria-pressed={wasFollowing}
        title={isFollowRequestPending ? "Cancel follow request" : undefined}
        style={style}
      >
        {isFollowing ? "Following" : isFollowRequestPending ? "Requested" : "Follow"}
      </button>
    </form>
  );
}
