import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Book as BookIcon, ChevronDown, ChevronUp, FileText, Pencil, Plus, X } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { listAllBookChapters } from "@/lib/wiki";
import { deleteBook } from "@/app/actions/books";
import { deleteBookChapter, moveWikiPage } from "@/app/actions/knowledge-pages";
import { SettingsRow } from "@/components/SettingsRow";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmButton } from "@/components/ConfirmButton";
import { BookForm } from "../../BookForm";
import { BookChapterForm } from "../../BookChapterForm";

export const metadata: Metadata = { title: "Books" };

export default async function BooksSettingsPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  if (!currentUser.profile) redirect("/claim-username");

  const myBooks = await db.book.findMany({
    where: { profileId: currentUser.profile.id },
    orderBy: { createdAt: "desc" },
  });
  const chaptersByBook = new Map(
    await Promise.all(myBooks.map(async (book) => [book.id, await listAllBookChapters(book.id)] as const))
  );
  const chapterBodyById = new Map<string, string>();
  for (const chapters of chaptersByBook.values()) {
    const withBody = await db.wikiPage.findMany({
      where: { id: { in: chapters.map((c) => c.id) } },
      include: { currentRevision: { select: { body: true } } },
    });
    for (const c of withBody) chapterBodyById.set(c.id, c.currentRevision?.body ?? "");
  }

  return (
    <div className="settingsSection">
      <h2 className="settingsSectionHeading">Books</h2>
      {myBooks.length === 0 && <EmptyState message="No books yet." />}
      {myBooks.map((book) => {
        const chapters = chaptersByBook.get(book.id) ?? [];
        return (
          <div key={book.id} id={`book-${book.id}`} className="settingsGroup" style={{ marginBottom: "var(--space-3)" }}>
            <SettingsRow
              icon={BookIcon}
              thumbnail={
                book.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small settings-list thumbnail, not an optimizable static asset
                  <img src={book.coverImageUrl} alt="" />
                ) : undefined
              }
              label={book.title}
              description={`${book.status} · ${book.visibility}`}
              trailing={
                <>
                  {currentUser.username && (
                    <Link href={`/${currentUser.username.handle}/books/${book.slug}`} className="button buttonSecondary buttonSmall">View</Link>
                  )}
                  <form action={deleteBook}>
                    <input type="hidden" name="bookId" value={book.id} />
                    <ConfirmButton
                      className="button buttonSecondary buttonSmall"
                      title="Delete this book?"
                      description="This deletes every chapter too. This can't be undone."
                      confirmLabel="Delete"
                    >
                      Delete
                    </ConfirmButton>
                  </form>
                </>
              }
            />

            {chapters.map((chapter) => {
              // Same per-parent scoping as content/wiki/page.tsx — chapters
              // is already grouped by parentPageId (listAllBookChapters),
              // but index/isFirst/isLast still need computing per group.
              const siblings = chapters.filter((c) => c.parentPageId === chapter.parentPageId);
              const siblingIndex = siblings.findIndex((c) => c.id === chapter.id);
              return (
              <SettingsRow
                key={chapter.id}
                icon={FileText}
                label={`${chapter.parentPageId ? "— " : ""}${chapter.title}`}
                trailing={
                  <>
                    <form action={moveWikiPage}>
                      <input type="hidden" name="pageId" value={chapter.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button type="submit" className="button buttonSecondary iconButton" disabled={siblingIndex === 0} aria-label="Move up"><ChevronUp size={16} aria-hidden="true" /></button>
                    </form>
                    <form action={moveWikiPage}>
                      <input type="hidden" name="pageId" value={chapter.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button type="submit" className="button buttonSecondary iconButton" disabled={siblingIndex === siblings.length - 1} aria-label="Move down"><ChevronDown size={16} aria-hidden="true" /></button>
                    </form>
                    <form action={deleteBookChapter}>
                      <input type="hidden" name="pageId" value={chapter.id} />
                      <ConfirmButton
                        className="button buttonSecondary iconButton"
                        title="Delete this chapter?"
                        description="This can't be undone."
                        confirmLabel="Delete"
                        aria-label="Delete chapter"
                      >
                        <X size={16} aria-hidden="true" />
                      </ConfirmButton>
                    </form>
                  </>
                }
              />
              );
            })}

            <details>
              <summary className="settingsRow settingsAddTrigger">
                <span className="settingsRowIcon" aria-hidden="true">
                  <Pencil size={16} />
                </span>
                <span className="settingsRowText">
                  <span className="settingsRowLabel">Edit chapters</span>
                </span>
              </summary>
              <div className="settingsAddPanelBody" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {chapters.map((chapter) => (
                  <details key={chapter.id} className="settingsGroup">
                    <summary className="settingsRow settingsAddTrigger">
                      <span className="settingsRowText">
                        <span className="settingsRowLabel">{chapter.title}</span>
                      </span>
                    </summary>
                    <div className="settingsAddPanelBody">
                      <BookChapterForm
                        bookId={book.id}
                        chapter={{ ...chapter, body: chapterBodyById.get(chapter.id) ?? "", visibility: chapter.visibility ?? "public" }}
                        otherChapters={chapters.map((c) => ({ id: c.id, title: c.title }))}
                      />
                    </div>
                  </details>
                ))}
                <details className="settingsGroup">
                  <summary className="settingsRow settingsAddTrigger">
                    <span className="settingsRowIcon" aria-hidden="true">
                      <Plus size={18} />
                    </span>
                    <span className="settingsRowText">
                      <span className="settingsRowLabel">Add chapter</span>
                    </span>
                  </summary>
                  <div className="settingsAddPanelBody">
                    <BookChapterForm bookId={book.id} otherChapters={chapters.map((c) => ({ id: c.id, title: c.title }))} />
                  </div>
                </details>
              </div>
            </details>

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
                <BookForm book={book} />
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
            <span className="settingsRowLabel">Create a book</span>
          </span>
        </summary>
        <div className="settingsAddPanelBody">
          <BookForm />
        </div>
      </details>
    </div>
  );
}
