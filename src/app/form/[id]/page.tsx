import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { FormFieldDef } from "@/app/actions/forms";
import { renderWikiMarkdown } from "@/lib/wiki-markdown";
import { SubmitForm } from "./SubmitForm";

export default async function PublicFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await db.form.findUnique({ where: { id } });
  if (!form || form.status !== "published") notFound();

  const fields = JSON.parse(form.fieldsJson) as FormFieldDef[];

  return (
    <div className="profileCard">
      <h1 style={{ fontSize: "1.2rem", fontWeight: 700 }}>{form.title}</h1>
      <p className="mutedText" style={{ marginBottom: form.description ? "0.5rem" : "1rem" }}>{form.mode === "survey" ? "Survey" : "Form"}</p>
      {form.description && <div style={{ marginBottom: "1rem" }}>{renderWikiMarkdown(form.description)}</div>}
      <SubmitForm formId={form.id} fields={fields} />
    </div>
  );
}
