import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, ChevronDown, ChevronUp, Pencil, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { listAllProfileWikiPages } from "@/lib/wiki";
import { deleteProfileWikiPage, moveWikiPage } from "@/app/actions/knowledge-pages";
import { SettingsRow } from "@/components/SettingsRow";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmButton } from "@/components/ConfirmButton";
import { WikiPageForm } from "../../WikiPageForm";

export const metadata: Metadata = { title: "Wiki & Documentation" };

const KIND_LABEL: Record<string, string> = { wiki: "Wiki page", documentation: "Documentation" };

export default async function WikiSettingsPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  if (!currentUser.profile) redirect("/claim-username");

  const pages = await listAllProfileWikiPages(currentUser.profile.id);
  const pagesWithBody = await db.wikiPage.findMany({
    where: { profileId: currentUser.profile.id },
    include: { currentRevision: { select: { body: true } } },
  });
  const bodyById = new Map(pagesWithBody.map((p) => [p.id, p.currentRevision?.body ?? ""]));

  return (
    <div className="settingsSection">
      <h2 className="settingsSectionHeading">Wiki &amp; Documentation</h2>
      {pages.length === 0 && <EmptyState message="No pages yet." />}
      {pages.map((page) => {
        // Reordering is scoped to siblings under the same parent (matches
        // moveWikiPage's own scoping) — `pages` groups siblings contiguously
        // already (listAllProfileWikiPages orders by [parentPageId, position])
        // but index/isFirst/isLast still need to be computed per group, not
        // over the whole flat list.
        const siblings = pages.filter((p) => p.parentPageId === page.parentPageId);
        const siblingIndex = siblings.findIndex((p) => p.id === page.id);
        return (
        <div key={page.id} id={`wiki-${page.id}`} className="settingsGroup" style={{ marginBottom: "var(--space-3)" }}>
          <SettingsRow
            icon={BookOpen}
            label={page.title}
            description={`${KIND_LABEL[page.kind]} · ${page.visibility}${page.parentPageId ? " · sub-page" : ""}`}
            trailing={
              <>
                <form action={moveWikiPage}>
                  <input type="hidden" name="pageId" value={page.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button type="submit" className="button buttonSecondary iconButton" disabled={siblingIndex === 0} aria-label="Move up"><ChevronUp size={16} aria-hidden="true" /></button>
                </form>
                <form action={moveWikiPage}>
                  <input type="hidden" name="pageId" value={page.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button type="submit" className="button buttonSecondary iconButton" disabled={siblingIndex === siblings.length - 1} aria-label="Move down"><ChevronDown size={16} aria-hidden="true" /></button>
                </form>
                {currentUser.username && (
                  <Link href={`/${currentUser.username.handle}/wiki/${page.slug}`} className="button buttonSecondary buttonSmall">View</Link>
                )}
                <form action={deleteProfileWikiPage}>
                  <input type="hidden" name="pageId" value={page.id} />
                  <ConfirmButton
                    className="button buttonSecondary buttonSmall"
                    title="Delete this wiki page?"
                    description="This can't be undone."
                    confirmLabel="Delete"
                  >
                    Delete
                  </ConfirmButton>
                </form>
              </>
            }
          />
          <details>
            <summary className="settingsRow settingsAddTrigger">
              <span className="settingsRowIcon" aria-hidden="true">
                <Pencil size={16} />
              </span>
              <span className="settingsRowText">
                <span className="settingsRowLabel">Edit details</span>
              </span>
            </summary>
            <div className="settingsAddPanelBody">
              <WikiPageForm
                page={{ ...page, body: bodyById.get(page.id) ?? "", visibility: page.visibility ?? "public" }}
                otherPages={pages.map((p) => ({ id: p.id, title: p.title }))}
              />
            </div>
          </details>
        </div>
        );
      })}
      <details className="settingsGroup">
        <summary className="settingsRow settingsAddTrigger">
          <span className="settingsRowIcon" aria-hidden="true">
            <Plus size={18} />
          </span>
          <span className="settingsRowText">
            <span className="settingsRowLabel">Write a page</span>
          </span>
        </summary>
        <div className="settingsAddPanelBody">
          <WikiPageForm otherPages={pages.map((p) => ({ id: p.id, title: p.title }))} />
        </div>
      </details>
    </div>
  );
}
