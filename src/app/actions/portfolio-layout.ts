"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOwnProfile } from "@/lib/auth-guards";
import { parsePortfolioLayout, serializePortfolioLayout, PORTFOLIO_SECTION_KEYS, type PortfolioSectionKey } from "@/lib/portfolio-layout";

function isPortfolioSectionKey(value: string): value is PortfolioSectionKey {
  return (PORTFOLIO_SECTION_KEYS as readonly string[]).includes(value);
}

// Same swap-adjacent-entry convention moveLink/moveSkill use for DB
// position columns, applied to the JSON-array order instead — this
// codebase's one ordering mechanism, reused a fourth time.
// FIX_PLAN P2: both actions below used to read-modify-write the single
// portfolioLayoutJson column outside any transaction — a rapid double-click
// (or two tabs) could interleave two reads of the same starting JSON, and
// the second write would silently clobber the first's change instead of
// building on it. Re-reading the profile *inside* the transaction closes
// that window the same way this session's other reorder fixes do.
export async function movePortfolioSection(formData: FormData): Promise<void> {
  const user = await requireOwnProfile();
  const key = String(formData.get("key") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!isPortfolioSectionKey(key) || (direction !== "up" && direction !== "down")) return;

  await db.$transaction(async (tx) => {
    const profile = await tx.profile.findUnique({ where: { userId: user.id } });
    if (!profile) return;

    const entries = parsePortfolioLayout(profile.portfolioLayoutJson);
    const index = entries.findIndex((e) => e.key === key);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || swapIndex < 0 || swapIndex >= entries.length) return;

    [entries[index], entries[swapIndex]] = [entries[swapIndex], entries[index]];
    await tx.profile.update({ where: { id: profile.id }, data: { portfolioLayoutJson: serializePortfolioLayout(entries) } });
  });

  if (user.username) revalidatePath(`/s/${user.username.handle}`);
  if (user.username) revalidatePath(`/${user.username.handle}`);
}

export async function togglePortfolioSectionVisibility(formData: FormData): Promise<void> {
  const user = await requireOwnProfile();
  const key = String(formData.get("key") ?? "");
  if (!isPortfolioSectionKey(key)) return;

  await db.$transaction(async (tx) => {
    const profile = await tx.profile.findUnique({ where: { userId: user.id } });
    if (!profile) return;

    const entries = parsePortfolioLayout(profile.portfolioLayoutJson).map((e) =>
      e.key === key ? { ...e, visible: !e.visible } : e
    );
    await tx.profile.update({ where: { id: profile.id }, data: { portfolioLayoutJson: serializePortfolioLayout(entries) } });
  });

  if (user.username) revalidatePath(`/s/${user.username.handle}`);
  if (user.username) revalidatePath(`/${user.username.handle}`);
}
