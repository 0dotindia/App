"use client";

import { useState } from "react";
import Image from "next/image";

type MediaItem = { id: string; url: string };

// Extracted from PostCard.tsx (same "PostCard stays a Server Component, this
// is the one small client island it needs" posture as LikeButton.tsx) — the
// only thing this needed client-side state for: a shimmer placeholder behind
// each image until it finishes loading, instead of popping in abruptly.
// No per-image blurhash exists in the data model (MediaItem is just
// {id, url}) and adding one is a schema change out of scope here, so this
// reuses the existing .skeletonBlock shimmer (globals.css, already respects
// prefers-reduced-motion) rather than next/image's placeholder="blur".
function MediaGridItem({
  item,
  index,
  authorName,
  columns,
  priority,
}: {
  item: MediaItem;
  index: number;
  authorName: string;
  columns: number;
  priority: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="postMediaItem" style={{ position: "relative" }}>
      {!loaded && (
        <div className="skeletonBlock" style={{ position: "absolute", inset: 0, borderRadius: 0 }} aria-hidden="true" />
      )}
      {/* No per-image caption exists in the data model yet (MediaItem is
          just {id, url}) — this generic description is meaningfully better
          than empty alt="" (which claims the image is decorative, when
          it's the actual content someone is looking at) without a data
          model change to add real author-authored captions. */}
      <Image
        src={item.url}
        alt={`Image ${index + 1} posted by ${authorName}`}
        fill
        sizes={columns === 1 ? "(max-width: 640px) 100vw, 640px" : "(max-width: 640px) 50vw, 320px"}
        style={{ objectFit: "cover", opacity: loaded ? 1 : 0, transition: "opacity var(--duration-3, 240ms) ease" }}
        priority={priority && index === 0}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

// `priority`: only ever true for the very first image of the very first post
// in a list (each caller passes it just for index === 0) — Lighthouse
// confirmed live on 0dot.in/feed that this exact image is the page's LCP
// element, and a plain <img loading="lazy"> actively deferred it despite
// already being above the fold. next/image with `fill` (blob storage is
// already in next.config.ts's images.remotePatterns) gets it a same-domain
// optimized/responsive source, correct `loading`/`fetchPriority`, and no
// separate img-src allowlist entry needed. `fill` needs a sized, positioned
// ancestor — .postMediaItem already is one (fixed aspect-ratio, width:100%).
export function PostMediaGrid({ media, authorName, priority = false }: { media: MediaItem[]; authorName: string; priority?: boolean }) {
  if (media.length === 0) return null;
  const columns = media.length === 1 ? 1 : 2;
  return (
    <div className="postMediaGrid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {media.map((item, index) => (
        <MediaGridItem key={item.id} item={item} index={index} authorName={authorName} columns={columns} priority={priority} />
      ))}
    </div>
  );
}
